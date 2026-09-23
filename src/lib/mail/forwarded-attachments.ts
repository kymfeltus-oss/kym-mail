import type { SupabaseClient } from "@supabase/supabase-js";
import type { MailAttachmentInput } from "@/domain/providers/mail-provider";
import { ValidationError } from "@/lib/errors";
import { validateAttachmentEntries } from "@/lib/mail/attachment-validation";
import { loadGoogleProvider } from "@/lib/mail/gmail-sync";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseForwardAttachmentIds(values: FormDataEntryValue[]) {
  if (values.some((value) => typeof value !== "string" || !UUID_PATTERN.test(value))) return null;
  const ids = values as string[];
  const uniqueIds = [...new Set(ids)];
  return uniqueIds.length === ids.length && ids.length <= 25 ? ids : null;
}

export async function loadForwardedAttachments(
  database: SupabaseClient,
  ownerId: string,
  senderConnectionId: string,
  attachmentIds: string[],
  additionalEntries: Array<{ name: string; size: number }> = []
): Promise<MailAttachmentInput[]> {
  if (!attachmentIds.length) return [];
  const { data: rows, error } = await database.from("mail_attachments")
    .select("id, message_id, provider_attachment_id, filename, mime_type, size_bytes")
    .eq("owner_id", ownerId)
    .in("id", attachmentIds);
  if (error || !rows || rows.length !== attachmentIds.length) throw new ValidationError("One or more forwarded attachments are unavailable.");

  const orderedRows = attachmentIds.map((id) => rows.find((row) => row.id === id));
  if (orderedRows.some((row) => !row)) throw new ValidationError("One or more forwarded attachments are unavailable.");
  const sourceRows = orderedRows.filter((row): row is NonNullable<typeof row> => Boolean(row));
  const messageIds = [...new Set(sourceRows.map((row) => row.message_id))];
  if (messageIds.length !== 1 || sourceRows.some((row) => row.provider_attachment_id.startsWith("inline:"))) {
    throw new ValidationError("The original attachments cannot be forwarded safely.");
  }

  const { data: sourceMessage, error: messageError } = await database.from("mail_messages")
    .select("id, provider_message_id, mail_connection_id")
    .eq("id", messageIds[0])
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (messageError || !sourceMessage || sourceMessage.mail_connection_id !== senderConnectionId) {
    throw new ValidationError("The original message is unavailable through the selected sender.");
  }

  const metadataEntries = sourceRows.map((row) => ({ name: row.filename, size: Number(row.size_bytes) }));
  if (!validateAttachmentEntries([...additionalEntries, ...metadataEntries])) {
    throw new ValidationError("The combined attachments are unsupported, too large, or too numerous.");
  }

  const { provider } = await loadGoogleProvider(database, senderConnectionId);
  const attachments = await Promise.all(sourceRows.map(async (row) => {
    const result = await provider.getAttachment(sourceMessage.provider_message_id, row.provider_attachment_id);
    return {
      filename: row.filename,
      mimeType: row.mime_type || "application/octet-stream",
      content: new Uint8Array(Buffer.from(result.data, "base64url"))
    };
  }));
  if (!validateAttachmentEntries([...additionalEntries, ...attachments.map((attachment) => ({ name: attachment.filename, size: attachment.content.byteLength }))])) {
    throw new ValidationError("The combined attachments are unsupported, too large, or too numerous.");
  }
  return attachments;
}
