import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { fillFollowUp, firstFollowUpAt, nameFromEmail } from "@/lib/mail/follow-up";
import { replyRecipient, replySubject } from "@/lib/mail/reply-forward";
import { scheduledRfcMessageId } from "@/lib/scheduling/constants";
import { isValidTimeZone } from "@/lib/scheduling/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const requestSchema = z.object({
  threadIds: z.array(z.string().uuid()).min(1).max(20),
  timezone: z.string().trim().min(1).max(100),
  companyName: z.string().trim().max(160).default(""),
  followUpOne: z.string().trim().min(1).max(5000),
  followUpTwo: z.string().trim().min(1).max(5000)
});

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) throw new ValidationError("Choose a time zone and both follow-up notes.");
    const input = parsed.data;
    const database = createSupabaseAdminClient();
    const { data: identities, error: identityError } = await owner.database.from("mail_accounts").select("id, email_address").eq("owner_id", owner.user.id);
    if (identityError) throw new ValidationError("Sender identities are unavailable.");
    const identityEmails = (identities ?? []).map((identity) => identity.email_address);
    const started: string[] = [];
    const skipped: Array<{ threadId: string; reason: string }> = [];

    for (const threadId of input.threadIds) {
      const reason = await enrollThread(database, owner.user.id, identityEmails, threadId, input);
      if (reason) skipped.push({ threadId, reason });
      else started.push(threadId);
    }
    log("info", "mail.outreach_sequences_started", { started: started.length, skipped: skipped.length });
    return NextResponse.json({ started: started.length, skipped }, { status: started.length ? 201 : 400 });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.code === "VALIDATION" ? safe.safeMessage : "The follow-up sequence could not be started." }, { status: safe.code === "VALIDATION" ? 400 : 503 });
  }
}

async function enrollThread(
  database: ReturnType<typeof createSupabaseAdminClient>,
  ownerId: string,
  identityEmails: string[],
  threadId: string,
  input: z.infer<typeof requestSchema>
) {
  const { data: thread } = await database.from("mail_threads").select("id, provider_thread_id, subject, project_id, mail_account_id").eq("id", threadId).eq("owner_id", ownerId).maybeSingle();
  if (!thread?.provider_thread_id) return "That conversation is not available.";
  const { data: existing } = await database.from("outreach_sequences").select("id").eq("mail_thread_id", threadId).eq("status", "active").maybeSingle();
  if (existing) return "A follow-up sequence is already running for this conversation.";
  const { data: sent } = await database.from("mail_messages").select("mail_account_id, from_address, to_addresses, cc_addresses, subject, internet_message_id, sent_at").eq("thread_id", threadId).eq("owner_id", ownerId).eq("is_sent", true).order("sent_at", { ascending: false }).limit(1).maybeSingle();
  if (!sent?.internet_message_id) return "Sync this sent message before starting a same-thread follow-up.";
  const recipient = replyRecipient({ fromAddress: sent.from_address, toAddresses: sent.to_addresses ?? [], ccAddresses: sent.cc_addresses ?? [] }, identityEmails);
  if (!recipient) return "This message has no outside recipient.";
  const recipientName = nameFromEmail(recipient);
  const scheduledFor = firstFollowUpAt(new Date(sent.sent_at), input.timezone).toISOString();
  const sequenceId = crypto.randomUUID();
  const scheduledId = crypto.randomUUID();
  const subject = replySubject(sent.subject || thread.subject).slice(0, 200);
  const { error: sequenceError } = await database.from("outreach_sequences").insert({
    id: sequenceId,
    owner_id: ownerId,
    mail_thread_id: thread.id,
    mail_account_id: sent.mail_account_id,
    project_id: thread.project_id,
    recipient_email: recipient,
    recipient_name: recipientName,
    company_name: input.companyName,
    timezone: input.timezone,
    initial_sent_at: sent.sent_at,
    lead_status: "sent",
    sequence_stage: 1,
    next_action_at: scheduledFor,
    follow_up_one_body: input.followUpOne,
    follow_up_two_body: input.followUpTwo,
    provider_thread_id: thread.provider_thread_id,
    reply_to_message_id: sent.internet_message_id,
    subject: (sent.subject || thread.subject || "(no subject)").slice(0, 200)
  });
  if (sequenceError) return "This conversation could not be added.";
  const { error: scheduleError } = await database.from("scheduled_messages").insert({
    id: scheduledId,
    owner_id: ownerId,
    mail_account_id: sent.mail_account_id,
    project_id: thread.project_id,
    provider_thread_id: thread.provider_thread_id,
    reply_to_message_id: sent.internet_message_id,
    rfc_message_id: scheduledRfcMessageId(scheduledId),
    to_addresses: [recipient],
    subject,
    text_body: fillFollowUp(input.followUpOne, recipientName),
    scheduled_for: scheduledFor,
    next_attempt_at: scheduledFor,
    timezone: input.timezone,
    outreach_sequence_id: sequenceId,
    outreach_touch: 2
  });
  if (scheduleError) {
    await database.from("outreach_sequences").delete().eq("id", sequenceId).eq("owner_id", ownerId);
    return "The first follow-up could not be scheduled.";
  }
  return null;
}
