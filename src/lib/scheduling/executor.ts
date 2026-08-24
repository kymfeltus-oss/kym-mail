import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, toSafeError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { loadGoogleProvider, syncGmailMessageById } from "@/lib/mail/gmail-sync";
import { scheduledAttachmentBucket } from "@/lib/scheduling/constants";

type ScheduledRecord = {
  id: string;
  owner_id: string;
  mail_account_id: string;
  project_id: string | null;
  provider_thread_id: string | null;
  reply_to_message_id: string | null;
  rfc_message_id: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  text_body: string;
  processing_token: string;
  attempt_count: number;
  max_attempts: number;
};

type ExecutionSummary = { claimed: number; sent: number; retried: number; failed: number; reconciled: number };

function providerStatus(error: unknown) {
  if (!(error instanceof AppError) || typeof error.details !== "object" || error.details === null) return null;
  const status = (error.details as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function retryable(error: unknown) {
  if (!(error instanceof AppError) || error.code !== "PROVIDER_UNAVAILABLE") return false;
  const status = providerStatus(error);
  return status === null || status === 408 || status === 429 || status >= 500;
}

export function scheduledFailureDecision(error: unknown, attemptCount: number, maxAttempts: number) {
  const safe = toSafeError(error);
  const retry = retryable(error) && attemptCount < maxAttempts;
  if (retry) return {
    retry: true as const,
    code: safe.code,
    message: "Delivery was temporarily unavailable and will be retried."
  };
  if (safe.code === "UNAUTHORIZED") return {
    retry: false as const,
    code: "REAUTHORIZATION_REQUIRED",
    message: "Reconnect Google Mail before retrying this delivery."
  };
  return { retry: false as const, code: safe.code, message: safe.safeMessage };
}

async function storedAttachments(database: SupabaseClient, record: ScheduledRecord) {
  const { data: rows, error } = await database.from("scheduled_message_attachments")
    .select("object_path, filename, mime_type, size_bytes, sha256")
    .eq("scheduled_message_id", record.id)
    .eq("owner_id", record.owner_id)
    .order("created_at");
  if (error) throw new AppError("CONFIGURATION", "Scheduled attachments are unavailable.");
  const attachments = [] as Array<{ filename: string; mimeType: string; content: Uint8Array }>;
  for (const row of rows ?? []) {
    const { data, error: downloadError } = await database.storage.from(scheduledAttachmentBucket).download(row.object_path);
    if (downloadError || !data) throw new AppError("CONFIGURATION", "A scheduled attachment is unavailable.");
    const content = new Uint8Array(await data.arrayBuffer());
    const checksum = createHash("sha256").update(content).digest("hex");
    if (content.byteLength !== Number(row.size_bytes) || checksum !== row.sha256) throw new AppError("CONFIGURATION", "A scheduled attachment failed its integrity check.");
    attachments.push({ filename: row.filename, mimeType: row.mime_type, content });
  }
  return attachments;
}

async function currentIdentity(database: SupabaseClient, record: Pick<ScheduledRecord, "owner_id" | "mail_account_id">) {
  const { data, error } = await database.from("mail_accounts")
    .select("id, email_address, mail_connection_id, is_active, send_as_state")
    .eq("id", record.mail_account_id)
    .eq("owner_id", record.owner_id)
    .maybeSingle();
  if (error || !data?.mail_connection_id || !data.is_active || data.send_as_state !== "available") {
    throw new AppError("CONFIGURATION", "The approved sender identity is unavailable.");
  }
  return data;
}

async function synchronizedMessageId(database: SupabaseClient, record: Pick<ScheduledRecord, "project_id">, connectionId: string, providerMessageId: string) {
  await syncGmailMessageById(database, connectionId, providerMessageId, record.project_id);
  const { data } = await database.from("mail_messages").select("id").eq("mail_connection_id", connectionId).eq("provider_message_id", providerMessageId).maybeSingle();
  return data?.id ?? null;
}

async function markSent(database: SupabaseClient, record: ScheduledRecord, result: { messageId: string; threadId: string; historyId?: string }, sentMessageId: string | null) {
  const now = new Date().toISOString();
  const { data, error } = await database.from("scheduled_messages").update({
    status: "SENT",
    provider_message_id: result.messageId,
    provider_thread_result_id: result.threadId,
    provider_history_id: result.historyId ?? null,
    sent_message_id: sentMessageId,
    sent_at: now,
    processing_token: null,
    claimed_at: null,
    last_error_code: sentMessageId ? null : "SENT_SYNC_PENDING",
    last_error_message: sentMessageId ? null : "The email was sent and is awaiting mailbox synchronization.",
    updated_at: now
  }).eq("id", record.id).eq("status", "PROCESSING").eq("processing_token", record.processing_token).select("id").maybeSingle();
  if (error || !data) throw new AppError("CONFLICT", "Scheduled delivery was already finalized.");
}

async function markFailure(database: SupabaseClient, record: ScheduledRecord, error: unknown) {
  const decision = scheduledFailureDecision(error, record.attempt_count, record.max_attempts);
  const now = new Date();
  const update = decision.retry ? {
    status: "SCHEDULED",
    next_attempt_at: new Date(now.getTime() + Math.max(2, record.attempt_count * 2) * 60_000).toISOString(),
    processing_token: null,
    claimed_at: null,
    last_error_code: decision.code,
    last_error_message: decision.message,
    updated_at: now.toISOString()
  } : {
    status: "FAILED",
    processing_token: null,
    claimed_at: null,
    last_error_code: decision.code,
    last_error_message: decision.message,
    updated_at: now.toISOString()
  };
  await database.from("scheduled_messages").update(update).eq("id", record.id).eq("status", "PROCESSING").eq("processing_token", record.processing_token);
  return decision.retry;
}

async function reconcileSent(database: SupabaseClient) {
  const { data } = await database.from("scheduled_messages").select("id, owner_id, mail_account_id, project_id, provider_message_id").eq("status", "SENT").is("sent_message_id", null).not("provider_message_id", "is", null).limit(10);
  let reconciled = 0;
  for (const row of data ?? []) {
    try {
      const identity = await currentIdentity(database, row);
      const messageId = await synchronizedMessageId(database, row, identity.mail_connection_id, row.provider_message_id);
      if (messageId) {
        await database.from("scheduled_messages").update({ sent_message_id: messageId, last_error_code: null, last_error_message: null, updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "SENT").is("sent_message_id", null);
        reconciled += 1;
      }
    } catch {
      // The email is already sent. A later executor invocation may safely retry synchronization.
    }
  }
  return reconciled;
}

export async function executeDueScheduledMessages(database: SupabaseClient): Promise<ExecutionSummary> {
  await database.rpc("recover_stale_scheduled_messages");
  const reconciled = await reconcileSent(database);
  const { data, error } = await database.rpc("claim_due_scheduled_messages", { claim_limit: 10 });
  if (error) throw new AppError("INTERNAL", "Scheduled deliveries could not be claimed.");
  const records = (data ?? []) as ScheduledRecord[];
  const summary: ExecutionSummary = { claimed: records.length, sent: 0, retried: 0, failed: 0, reconciled };

  for (const record of records) {
    try {
      const identity = await currentIdentity(database, record);
      const { provider } = await loadGoogleProvider(database, identity.mail_connection_id);
      const existing = await provider.listMessageIds(`rfc822msgid:${record.rfc_message_id}`, 1);
      let result: { messageId: string; threadId: string; historyId?: string };
      if (existing[0]) {
        result = { messageId: existing[0].messageId, threadId: existing[0].threadId };
      } else {
        result = await provider.send({
          from: identity.email_address,
          to: record.to_addresses,
          cc: record.cc_addresses,
          bcc: record.bcc_addresses,
          subject: record.subject,
          textBody: record.text_body,
          attachments: await storedAttachments(database, record),
          messageId: record.rfc_message_id,
          threadId: record.provider_thread_id ?? undefined,
          replyToMessageId: record.reply_to_message_id ?? undefined
        });
      }
      let sentMessageId: string | null = null;
      try { sentMessageId = await synchronizedMessageId(database, record, identity.mail_connection_id, result.messageId); }
      catch { /* Delivery succeeded; reconciliation is retried separately without another send. */ }
      await markSent(database, record, result, sentMessageId);
      summary.sent += 1;
    } catch (error) {
      const retried = await markFailure(database, record, error);
      if (retried) summary.retried += 1; else summary.failed += 1;
      log("error", "mail.scheduled_delivery_failed", { scheduledMessageId: record.id, code: toSafeError(error).code, retryQueued: retried });
    }
  }
  log("info", "mail.scheduled_executor_completed", summary);
  return summary;
}
