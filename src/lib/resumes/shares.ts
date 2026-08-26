import { createHash, randomBytes } from "node:crypto";

export function createResumeShareToken() {
  return randomBytes(32).toString("base64url");
}

export function hashResumeShareToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isResumeShareToken(value: string) {
  return /^[A-Za-z0-9_-]{40,80}$/.test(value);
}
