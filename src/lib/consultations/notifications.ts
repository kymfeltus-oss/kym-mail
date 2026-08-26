import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env";
import { loadGoogleProvider, syncGmailMessageById } from "@/lib/mail/gmail-sync";
import { log } from "@/lib/logger";
import { formatConsultationAmount } from "@/lib/consultations/validation";

type MailKind = "PROOF_RECEIVED" | "OWNER_REVIEW" | "APPROVED" | "REJECTED";

type NotificationInput = {
  ownerId: string;
  requestId: string;
  clientName: string;
  clientEmail: string;
  consultationName: string;
  expectedAmountCents: number;
  kind: MailKind;
  bookingToken?: string;
  rejectionReason?: string;
};

function notificationCopy(input: NotificationInput, ownerEmail: string) {
  if (input.kind === "OWNER_REVIEW") return {
    to: ownerEmail,
    subject: `Payment proof submitted — ${input.clientName}`,
    body: `${input.clientName} submitted payment proof for ${input.consultationName} (${formatConsultationAmount(input.expectedAmountCents)}).\n\nReview this submission in KYM Mail: ${getAppUrl()}/app/calendar\n\nThis is a manual proof review. Cash App has not verified or confirmed funds.`
  };
  if (input.kind === "APPROVED") return {
    to: input.clientEmail,
    subject: "Your consultation booking link is ready",
    body: `Hi ${input.clientName},\n\nYour payment proof has been approved by the owner. You may now schedule your ${input.consultationName}.\n\nSecure booking link: ${getAppUrl()}/consult/book/${input.bookingToken}\n\nThis approval reflects manual review of the submitted proof; it is not automatic Cash App verification.`
  };
  if (input.kind === "REJECTED") return {
    to: input.clientEmail,
    subject: "Update on your consultation payment proof",
    body: `Hi ${input.clientName},\n\nThe payment proof submitted for ${input.consultationName} was not approved by the owner.\n\nReason: ${input.rejectionReason}\n\nNo consultation booking link has been released.`
  };
  return {
    to: input.clientEmail,
    subject: "Payment proof received",
    body: `Hi ${input.clientName},\n\nPayment proof received and pending review for ${input.consultationName}. No booking is available until the owner completes manual review.\n\nYou will receive a separate message if the proof is approved.`
  };
}
export async function sendConsultationNotification(database: SupabaseClient, input: NotificationInput) {
  try {
    const [{ data: identity }, { data: ownerAccount }] = await Promise.all([
      database.from("mail_accounts").select("email_address, mail_connection_id").eq("owner_id", input.ownerId).eq("is_active", true).eq("send_as_state", "available").order("is_default", { ascending: false }).limit(1).maybeSingle(),
      database.auth.admin.getUserById(input.ownerId)
    ]);
    if (!identity?.mail_connection_id || !ownerAccount.user?.email) throw new Error("CONSULTATION_MAIL_IDENTITY_UNAVAILABLE");
    const mail = notificationCopy(input, ownerAccount.user.email);
    const { provider } = await loadGoogleProvider(database, identity.mail_connection_id);
    const result = await provider.send({ from: identity.email_address, to: [mail.to], subject: mail.subject, textBody: mail.body });
    try { await syncGmailMessageById(database, identity.mail_connection_id, result.messageId, null); } catch { /* Delivery is authoritative; mailbox sync can catch up. */ }
    await database.from("consultation_events").insert({ owner_id: input.ownerId, consultation_request_id: input.requestId, event_type: `${input.kind}_EMAIL_SENT`, actor_type: "SYSTEM" });
    return true;
  } catch (error) {
    log("warn", "consultation.notification_failed", { requestId: input.requestId, kind: input.kind, code: error instanceof Error ? error.message : "UNKNOWN" });
    await database.from("consultation_events").insert({ owner_id: input.ownerId, consultation_request_id: input.requestId, event_type: `${input.kind}_EMAIL_FAILED`, actor_type: "SYSTEM" });
    return false;
  }
}
