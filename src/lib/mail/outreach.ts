import type { SupabaseClient } from "@supabase/supabase-js";
import { sendLiveReplySms } from "@/lib/alerts/twilio-sms";
import { log } from "@/lib/logger";
import { classifyInbound, fillFollowUp, nameFromEmail, secondFollowUpAt } from "@/lib/mail/follow-up";
import { replySubject } from "@/lib/mail/reply-forward";
import { scheduledRfcMessageId } from "@/lib/scheduling/constants";

type SequenceRow = {
  id: string;
  owner_id: string;
  mail_account_id: string;
  project_id: string | null;
  recipient_email: string;
  recipient_name: string;
  company_name: string;
  timezone: string;
  provider_thread_id: string;
  subject: string;
  follow_up_two_body: string;
  status: string;
  lead_status: string;
};

export async function stopOutreachForInbound(database: SupabaseClient, input: { threadId: string; from: string; subject: string; text: string }) {
  const kind = classifyInbound(input);
  if (kind === "ooo") return;
  const { data: sequence } = await database.from("outreach_sequences").select("id, recipient_name, company_name").eq("mail_thread_id", input.threadId).eq("status", "active").maybeSingle();
  if (!sequence) return;
  const now = new Date().toISOString();
  const leadStatus = kind === "bounce" ? "bounced" : kind === "dnc" ? "do_not_contact" : "replied";
  const { data: stopped } = await database.from("outreach_sequences").update({
    status: "stopped",
    lead_status: leadStatus,
    stopped_reason: leadStatus,
    next_action_at: null,
    updated_at: now
  }).eq("id", sequence.id).eq("status", "active").select("id").maybeSingle();
  if (!stopped) return;
  await database.from("scheduled_messages").update({
    status: "CANCELLED",
    cancelled_at: now,
    updated_at: now
  }).eq("outreach_sequence_id", sequence.id).eq("status", "SCHEDULED");
  if (leadStatus !== "replied") return;
  try {
    const sent = await sendLiveReplySms(sequence.recipient_name || nameFromEmail(input.from), sequence.company_name);
    if (sent) await database.from("outreach_sequences").update({ alerted_at: now }).eq("id", sequence.id).is("alerted_at", null);
  } catch (error) {
    log("error", "mail.live_reply_sms_failed", { sequenceId: sequence.id });
    void error;
  }
}

export async function guardOutreachSend(database: SupabaseClient, sequenceId: string | null | undefined) {
  if (!sequenceId) return "send" as const;
  const { data: sequence } = await database.from("outreach_sequences").select("id, status, lead_status, mail_thread_id, initial_sent_at").eq("id", sequenceId).maybeSingle();
  if (!sequence || sequence.status !== "active" || sequence.lead_status === "replied" || sequence.lead_status === "bounced" || sequence.lead_status === "do_not_contact" || sequence.lead_status === "passive") {
    return "cancel" as const;
  }
  const { data: messages } = await database.from("mail_messages").select("from_address, subject, text_body, is_sent").eq("thread_id", sequence.mail_thread_id).gt("sent_at", sequence.initial_sent_at).order("sent_at", { ascending: false }).limit(20);
  for (const message of messages ?? []) {
    if (message.is_sent) continue;
    const kind = classifyInbound({ from: message.from_address, subject: message.subject, text: message.text_body ?? "" });
    if (kind === "ooo") continue;
    await stopOutreachForInbound(database, { threadId: sequence.mail_thread_id, from: message.from_address, subject: message.subject, text: message.text_body ?? "" });
    return "cancel" as const;
  }
  return "send" as const;
}

export async function advanceOutreachAfterSend(database: SupabaseClient, input: { sequenceId: string | null | undefined; touch: number | null | undefined; rfcMessageId: string; providerThreadId: string }) {
  if (!input.sequenceId || input.touch !== 2) {
    if (input.sequenceId && input.touch === 3) {
      const now = new Date().toISOString();
      await database.from("outreach_sequences").update({
        sequence_stage: 3,
        lead_status: "passive",
        status: "completed",
        next_action_at: null,
        updated_at: now
      }).eq("id", input.sequenceId).eq("status", "active");
    }
    return;
  }
  const { data: sequence } = await database.from("outreach_sequences").select("id, owner_id, mail_account_id, project_id, recipient_email, recipient_name, company_name, timezone, provider_thread_id, subject, follow_up_two_body, status").eq("id", input.sequenceId).maybeSingle();
  if (!sequence || sequence.status !== "active") return;
  const row = sequence as SequenceRow;
  const scheduledFor = secondFollowUpAt(new Date(), row.timezone).toISOString();
  const scheduledId = crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await database.from("scheduled_messages").insert({
    id: scheduledId,
    owner_id: row.owner_id,
    mail_account_id: row.mail_account_id,
    project_id: row.project_id,
    provider_thread_id: input.providerThreadId || row.provider_thread_id,
    reply_to_message_id: input.rfcMessageId,
    rfc_message_id: scheduledRfcMessageId(scheduledId),
    to_addresses: [row.recipient_email],
    cc_addresses: [],
    bcc_addresses: [],
    subject: replySubject(row.subject).slice(0, 200),
    text_body: fillFollowUp(row.follow_up_two_body, row.recipient_name),
    scheduled_for: scheduledFor,
    next_attempt_at: scheduledFor,
    timezone: row.timezone,
    outreach_sequence_id: row.id,
    outreach_touch: 3
  });
  if (error) {
    log("error", "mail.outreach_second_follow_up_failed", { sequenceId: row.id });
    return;
  }
  await database.from("outreach_sequences").update({
    sequence_stage: 2,
    next_action_at: scheduledFor,
    provider_thread_id: input.providerThreadId || row.provider_thread_id,
    updated_at: now
  }).eq("id", row.id).eq("status", "active");
}

export async function cancelOutreachSequence(database: SupabaseClient, ownerId: string, sequenceId: string) {
  const now = new Date().toISOString();
  const { data } = await database.from("outreach_sequences").update({
    status: "stopped",
    lead_status: "do_not_contact",
    stopped_reason: "do_not_contact",
    next_action_at: null,
    updated_at: now
  }).eq("id", sequenceId).eq("owner_id", ownerId).eq("status", "active").select("id").maybeSingle();
  if (!data) return false;
  await database.from("scheduled_messages").update({
    status: "CANCELLED",
    cancelled_at: now,
    updated_at: now
  }).eq("outreach_sequence_id", sequenceId).eq("owner_id", ownerId).eq("status", "SCHEDULED");
  return true;
}
