import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { getGoogleMailEnv } from "@/lib/env";
import { ConfigurationError } from "@/lib/errors";

function key() {
  const value = Buffer.from(getGoogleMailEnv().MAIL_TOKEN_ENCRYPTION_KEY, "base64");
  if (value.length !== 32) throw new ConfigurationError("Mail token encryption key is invalid.");
  return value;
}

export function encryptToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptToken(payload: string): string {
  const [version, iv, tag, encrypted] = payload.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new ConfigurationError("Stored mail token is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
