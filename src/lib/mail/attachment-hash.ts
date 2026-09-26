import { createHash } from "node:crypto";

export function attachmentSha256(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}
