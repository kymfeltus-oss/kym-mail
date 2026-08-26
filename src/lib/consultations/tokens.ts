import { createHash, randomBytes } from "node:crypto";

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createConsultationToken() {
  return randomBytes(32).toString("base64url");
}
export function isConsultationToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function hashConsultationToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
