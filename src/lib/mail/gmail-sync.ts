import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleMailProvider } from "@/integrations/google/google-mail-provider";
import { getGoogleMailEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { normalizeGmailMessage, type GmailMessage, type NormalizedGmailMessage } from "@/lib/mail/gmail-message";

type MailIdentity = { id: string; email_address: string; is_default: boolean };
type SyncMode = "initial" | "incremental";

export function uniqueProviderAttachments<T extends { providerAttachmentId: string }>(attachments: T[]) {
  return [...new Map(attachments.map((attachment) => [attachment.providerAttachmentId, attachment])).values()];
}

export function staleProviderAttachmentRowIds(
  existing: Array<{ id: string; provider_attachment_id: string }>,
  currentProviderIds: Iterable<string>
) {
  const current = new Set(currentProviderIds);
  return existing.filter((attachment) => !current.has(attachment.provider_attachment_id)).map((attachment) => attachment.id);
}

export type GmailSyncResult = {
  mode: SyncMode;
  upserted: number;
  deleted: number;
  skipped: number;
  historyId: string;
};

const INITIAL_SYNC_DAYS = 30;
const INITIAL_SYNC_LIMIT = 100;
const FETCH_CONCURRENCY = 8;

function providerStatus(error: unknown) {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== "object") return null;
  const status = (error.details as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function identityForMessage(message: NormalizedGmailMessage, identities: MailIdentity[]) {
  const candidates = message.isSent
    ? [message.fromAddress]
    : [...message.toAddresses, ...message.ccAddresses, ...message.bccAddresses];
  return identities.find((identity) => candidates.includes(identity.email_address)) ?? null;
}

function initialQuery(identities: MailIdentity[]) {
  const identityTerms = identities.flatMap((identity) => [`to:${identity.email_address}`, `from:${identity.email_address}`]);
  return `newer_than:${INITIAL_SYNC_DAYS}d {${identityTerms.join(" ")}}`;
}

export async function loadGoogleProvider(database: SupabaseClient, connectionId: string) {
  const [{ data: connection, error: connectionError }, { data: credentials, error: credentialError }] = await Promise.all([
    database.from("mail_connections").select("id, owner_id, connection_state, sync_history_id, initial_sync_completed_at, watch_expires_at").eq("id", connectionId).single(),
    database.from("mail_connection_credentials").select("mail_connection_id, encrypted_access_token, encrypted_refresh_token, token_expires_at").eq("mail_connection_id", connectionId).single()
  ]);
  if (connectionError || credentialError || !connection || !credentials) throw new AppError("UNAUTHORIZED", "Connect Google Mail to synchronize messages.");
  if (connection.connection_state !== "connected") throw new AppError("UNAUTHORIZED", "Reconnect Google Mail to synchronize messages.");
  return { connection, provider: new GoogleMailProvider({ id: credentials.mail_connection_id, ...credentials }, database) };
}

async function fetchMessages(provider: GoogleMailProvider, messageIds: string[]) {
  const messages: GmailMessage[] = [];
  let skipped = 0;
  for (let index = 0; index < messageIds.length; index += FETCH_CONCURRENCY) {
    const results = await Promise.allSettled(messageIds.slice(index, index + FETCH_CONCURRENCY).map((id) => provider.getMessage(id)));
    for (const result of results) {
      if (result.status === "fulfilled") messages.push(result.value as GmailMessage);
      else if (providerStatus(result.reason) === 404) skipped += 1;
      else throw result.reason;
    }
  }
  return { messages, skipped };
}

async function persistMessage(database: SupabaseClient, connectionId: string, ownerId: string, identity: MailIdentity, message: NormalizedGmailMessage, requestedProjectId?: string | null) {
  const { data: existingThread, error: threadLookupError } = await database
    .from("mail_threads")
    .select("id, last_message_at, project_id")
    .eq("mail_connection_id", connectionId)
    .eq("provider_thread_id", message.providerThreadId)
    .maybeSingle();
  if (threadLookupError) throw new AppError("INTERNAL", "The mailbox thread could not be synchronized.");

  if (requestedProjectId && existingThread?.project_id && requestedProjectId !== existingThread.project_id) {
    throw new AppError("CONFLICT", "This conversation already belongs to another Project.");
  }
  const projectId = requestedProjectId ?? existingThread?.project_id ?? null;

  let threadId = existingThread?.id;
  if (!threadId) {
    const { data: thread, error } = await database.from("mail_threads").insert({
      owner_id: ownerId,
      mail_account_id: identity.id,
      mail_connection_id: connectionId,
      provider_thread_id: message.providerThreadId,
      project_id: projectId,
      subject: message.subject,
      snippet: message.snippet,
      last_message_at: message.sentAt,
      is_unread: message.isUnread,
      has_attachments: message.attachments.length > 0
    }).select("id").single();
    if (error || !thread) throw new AppError("INTERNAL", "The mailbox thread could not be persisted.");
    threadId = thread.id;
  }

  const { data: persistedMessage, error: messageError } = await database.from("mail_messages").upsert({
    owner_id: ownerId,
    mail_account_id: identity.id,
    mail_connection_id: connectionId,
    thread_id: threadId,
    provider_message_id: message.providerMessageId,
    project_id: projectId,
    provider_history_id: message.providerHistoryId,
    internet_message_id: message.internetMessageId,
    from_address: message.fromAddress,
    to_addresses: message.toAddresses,
    cc_addresses: message.ccAddresses,
    bcc_addresses: message.bccAddresses,
    subject: message.subject,
    text_body: message.textBody,
    sanitized_html_body: message.sanitizedHtmlBody,
    sent_at: message.sentAt,
    is_inbox: message.isInbox,
    is_sent: message.isSent,
    is_draft: message.isDraft,
    is_unread: message.isUnread,
    updated_at: new Date().toISOString()
  }, { onConflict: "mail_connection_id,provider_message_id" }).select("id").single();
  if (messageError || !persistedMessage) throw new AppError("INTERNAL", "The mailbox message could not be persisted.");

  const currentAttachments = uniqueProviderAttachments(message.attachments);
  const { data: existingAttachments, error: existingAttachmentsError } = await database
    .from("mail_attachments")
    .select("id, provider_attachment_id")
    .eq("message_id", persistedMessage.id);
  if (existingAttachmentsError) throw new AppError("INTERNAL", "Attachment metadata could not be synchronized.");

  for (const attachment of currentAttachments) {
    const { error } = await database.from("mail_attachments").upsert({
      owner_id: ownerId,
      message_id: persistedMessage.id,
      provider_attachment_id: attachment.providerAttachmentId,
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size_bytes: attachment.sizeBytes
    }, { onConflict: "message_id,provider_attachment_id" });
    if (error) throw new AppError("INTERNAL", "Attachment metadata could not be persisted.");
  }
  const staleAttachmentIds = staleProviderAttachmentRowIds(
    existingAttachments ?? [],
    currentAttachments.map((attachment) => attachment.providerAttachmentId)
  );
  if (staleAttachmentIds.length) {
    const { error } = await database.from("mail_attachments").delete().in("id", staleAttachmentIds).eq("message_id", persistedMessage.id);
    if (error) throw new AppError("INTERNAL", "Stale attachment metadata could not be removed.");
  }

  const [{ data: unread }, { data: threadMessages }] = await Promise.all([
    database.from("mail_messages").select("id").eq("thread_id", threadId).eq("is_unread", true).limit(1),
    database.from("mail_messages").select("id").eq("thread_id", threadId)
  ]);
  const messageIds = (threadMessages ?? []).map((item) => item.id);
  const { data: attachmentRows } = messageIds.length
    ? await database.from("mail_attachments").select("id").in("message_id", messageIds).limit(1)
    : { data: [] };
  const isLatest = !existingThread || new Date(message.sentAt).getTime() >= new Date(existingThread.last_message_at).getTime();
  const threadUpdate = {
    is_unread: Boolean(unread?.length),
    has_attachments: Boolean(attachmentRows?.length),
    project_id: projectId,
    updated_at: new Date().toISOString(),
    ...(isLatest ? { mail_account_id: identity.id, subject: message.subject, snippet: message.snippet, last_message_at: message.sentAt } : {})
  };
  const { error: threadUpdateError } = await database.from("mail_threads").update(threadUpdate).eq("id", threadId);
  if (threadUpdateError) throw new AppError("INTERNAL", "The mailbox thread could not be updated.");
}

export async function syncGmailConnection(database: SupabaseClient, connectionId: string, requestedMode: SyncMode = "incremental"): Promise<GmailSyncResult> {
  const { connection, provider } = await loadGoogleProvider(database, connectionId);
  const { data: identities, error: identitiesError } = await database
    .from("mail_accounts")
    .select("id, email_address, is_default")
    .eq("owner_id", connection.owner_id)
    .eq("mail_connection_id", connectionId)
    .eq("send_as_state", "available")
    .eq("is_active", true)
    .order("is_default", { ascending: false });
  if (identitiesError || !identities?.length) throw new AppError("CONFIGURATION", "No verified KYM Mail sender identity is available.");

  const mode: SyncMode = requestedMode === "initial" || !connection.initial_sync_completed_at ? "initial" : "incremental";
  const messageIds = new Set<string>();
  const deletedMessageIds = new Set<string>();
  let latestHistoryId = connection.sync_history_id as string | null;
  let reconciledHistoryGap = false;

  if (mode === "initial") {
    const initialIds = await provider.listMessageIds(initialQuery(identities), INITIAL_SYNC_LIMIT);
    initialIds.forEach(({ messageId }) => messageIds.add(messageId));
  }

  if (latestHistoryId) {
    try {
      const history = await provider.listHistory(latestHistoryId);
      history.messageIds.forEach((id) => messageIds.add(id));
      history.deletedMessageIds.forEach((id) => deletedMessageIds.add(id));
      latestHistoryId = history.latestHistoryId;
    } catch (error) {
      if (providerStatus(error) !== 404) throw error;
      reconciledHistoryGap = true;
      const reconciliationIds = await provider.listMessageIds(initialQuery(identities), INITIAL_SYNC_LIMIT);
      reconciliationIds.forEach(({ messageId }) => messageIds.add(messageId));
      latestHistoryId = (await provider.getProfile()).historyId;
    }
  } else {
    latestHistoryId = (await provider.getProfile()).historyId;
  }

  if (deletedMessageIds.size) {
    const { error } = await database.from("mail_messages").delete().eq("mail_connection_id", connectionId).in("provider_message_id", [...deletedMessageIds]);
    if (error) throw new AppError("INTERNAL", "Deleted mailbox messages could not be reconciled.");
  }

  const fetched = await fetchMessages(provider, [...messageIds]);
  const normalized = fetched.messages.map(normalizeGmailMessage).filter((message): message is NormalizedGmailMessage => Boolean(message)).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  let upserted = 0;
  let skipped = fetched.skipped + (fetched.messages.length - normalized.length);
  for (const message of normalized) {
    const identity = identityForMessage(message, identities);
    if (!identity) {
      skipped += 1;
      await database.from("mail_messages").delete().eq("mail_connection_id", connectionId).eq("provider_message_id", message.providerMessageId);
      continue;
    }
    await persistMessage(database, connectionId, connection.owner_id, identity, message);
    upserted += 1;
  }

  const now = new Date().toISOString();
  const { error: stateError } = await database.from("mail_connections").update({
    sync_history_id: latestHistoryId,
    last_synced_at: now,
    initial_sync_completed_at: mode === "initial" ? now : connection.initial_sync_completed_at,
    sync_error: null,
    updated_at: now
  }).eq("id", connectionId);
  if (stateError) throw new AppError("INTERNAL", "Mailbox synchronization state could not be persisted.");

  const watchExpiresAt = connection.watch_expires_at ? new Date(connection.watch_expires_at).getTime() : 0;
  if (watchExpiresAt < Date.now() + 24 * 60 * 60 * 1000) {
    const watch = await provider.createWatch(getGoogleMailEnv().GMAIL_PUBSUB_TOPIC);
    await database.from("mail_connections").update({ watch_expires_at: watch.expiration.toISOString(), updated_at: new Date().toISOString() }).eq("id", connectionId);
  }

  log("info", "mail.gmail_sync_completed", { mailConnectionId: connectionId, mode, upserted, deleted: deletedMessageIds.size, skipped, reconciledHistoryGap });
  return { mode, upserted, deleted: deletedMessageIds.size, skipped, historyId: latestHistoryId };
}

export async function syncGmailMessageById(database: SupabaseClient, connectionId: string, providerMessageId: string, projectId?: string | null) {
  const { connection, provider } = await loadGoogleProvider(database, connectionId);
  const { data: identities, error } = await database
    .from("mail_accounts")
    .select("id, email_address, is_default")
    .eq("owner_id", connection.owner_id)
    .eq("mail_connection_id", connectionId)
    .eq("send_as_state", "available")
    .eq("is_active", true)
    .order("is_default", { ascending: false });
  if (error || !identities?.length) throw new AppError("CONFIGURATION", "No verified KYM Mail sender identity is available.");
  const normalized = normalizeGmailMessage(await provider.getMessage(providerMessageId) as GmailMessage);
  if (!normalized) throw new AppError("PROVIDER_UNAVAILABLE", "Google returned an unreadable message.");
  const identity = identityForMessage(normalized, identities);
  if (!identity) throw new AppError("CONFIGURATION", "The message does not belong to a configured KYM Mail identity.");
  await persistMessage(database, connectionId, connection.owner_id, identity, normalized, projectId);
  return normalized;
}
