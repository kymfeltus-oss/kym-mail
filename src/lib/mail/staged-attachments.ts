import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { MailAttachmentInput } from "@/domain/providers/mail-provider";
import { ValidationError } from "@/lib/errors";
import { composeAttachmentBucket } from "@/lib/scheduling/constants";
import { MAX_ATTACHMENT_COUNT, validateAttachmentEntries } from "@/lib/mail/attachment-validation";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mimeTypePattern = /^[\w!#$&^_.+-]+\/[\w!#$&^_.+-]+$/;

const stagedAttachmentSchema = z.object({
  path: z.string().min(1).max(200),
  filename: z.string().trim().min(1).max(255).refine((value) => !/[\\/\r\n]/.test(value)),
  mimeType: z.string().max(255),
  size: z.number().int().positive()
});

export type StagedAttachmentRef = z.infer<typeof stagedAttachmentSchema>;

export function isOwnedComposeAttachmentPath(path: string, ownerId: string) {
  const prefix = `${ownerId}/compose/`;
  return path.startsWith(prefix) && UUID_PATTERN.test(path.slice(prefix.length));
}

export function parseStagedAttachmentRefs(value: FormDataEntryValue | null, ownerId: string): StagedAttachmentRef[] {
  if (value === null) return [];
  if (typeof value !== "string" || value.length > 20_000) throw new ValidationError("The uploaded attachment selection is invalid.");
  let parsedValue: unknown;
  try { parsedValue = JSON.parse(value); }
  catch { throw new ValidationError("The uploaded attachment selection is invalid."); }
  const parsed = z.array(stagedAttachmentSchema).max(MAX_ATTACHMENT_COUNT).safeParse(parsedValue);
  if (!parsed.success) throw new ValidationError("The uploaded attachment selection is invalid.");
  const refs = parsed.data;
  if (refs.some((ref) => !isOwnedComposeAttachmentPath(ref.path, ownerId)) || new Set(refs.map((ref) => ref.path)).size !== refs.length) {
    throw new ValidationError("The uploaded attachment selection is invalid.");
  }
  if (!validateAttachmentEntries(refs.map(({ filename, size }) => ({ name: filename, size })))) {
    throw new ValidationError("Attachments must be safe file types, up to 18 MB each, with a combined limit of 18 MB and a maximum of 25 files.");
  }
  return refs;
}

export async function loadStagedAttachments(database: SupabaseClient, refs: StagedAttachmentRef[]): Promise<MailAttachmentInput[]> {
  const attachments = await Promise.all(refs.map(async (ref) => {
    const { data, error } = await database.storage.from(composeAttachmentBucket).download(ref.path);
    if (error || !data || data.size !== ref.size) throw new ValidationError("An uploaded attachment is unavailable or has changed. Please attach it again.");
    return {
      filename: ref.filename,
      mimeType: mimeTypePattern.test(ref.mimeType) ? ref.mimeType : "application/octet-stream",
      content: new Uint8Array(await data.arrayBuffer())
    };
  }));
  if (!validateAttachmentEntries(attachments.map(({ filename, content }) => ({ name: filename, size: content.byteLength })))) {
    throw new ValidationError("The uploaded attachments are unsupported, too large, or too numerous.");
  }
  return attachments;
}
