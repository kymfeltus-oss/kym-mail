import { createHash } from "node:crypto";
import { blockedAttachmentPattern } from "@/lib/mail/compose-validation";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 18 * 1024 * 1024;

export function validateAttachmentFiles(files: File[]) {
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  return totalBytes <= MAX_TOTAL_ATTACHMENT_BYTES
    && files.every((file) => file.size > 0 && file.size <= MAX_ATTACHMENT_BYTES && !blockedAttachmentPattern.test(file.name));
}

export function attachmentSha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}
