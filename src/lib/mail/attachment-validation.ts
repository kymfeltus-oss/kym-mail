import { createHash } from "node:crypto";
import { blockedAttachmentPattern } from "@/lib/mail/compose-validation";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 25;

export function validateAttachmentEntries(entries: Array<{ name: string; size: number }>) {
  const totalBytes = entries.reduce((total, entry) => total + entry.size, 0);
  return entries.length <= MAX_ATTACHMENT_COUNT
    && totalBytes <= MAX_TOTAL_ATTACHMENT_BYTES
    && entries.every((entry) => entry.size > 0 && entry.size <= MAX_ATTACHMENT_BYTES && !blockedAttachmentPattern.test(entry.name));
}

export function selectForwardableAttachments<T extends { name: string; size: number; providerAttachmentId: string }>(entries: T[]) {
  const selected: T[] = [];
  let totalBytes = 0;
  for (const entry of entries) {
    if (selected.length >= MAX_ATTACHMENT_COUNT
      || entry.providerAttachmentId.startsWith("inline:")
      || entry.size <= 0
      || entry.size > MAX_ATTACHMENT_BYTES
      || blockedAttachmentPattern.test(entry.name)
      || totalBytes + entry.size > MAX_TOTAL_ATTACHMENT_BYTES) continue;
    selected.push(entry);
    totalBytes += entry.size;
  }
  return selected;
}

export function validateAttachmentFiles(files: File[]) {
  return validateAttachmentEntries(files);
}

export function attachmentSha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}
