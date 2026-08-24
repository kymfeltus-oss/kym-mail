import { createHmac, timingSafeEqual } from "node:crypto";
import { getGoogleMailEnv } from "@/lib/env";

export type OAuthState = { ownerId: string; mailConnectionId: string; nonce: string; expiresAt: number };
export function signOAuthState(state: OAuthState): string {
  const body = Buffer.from(JSON.stringify(state)).toString("base64url");
  const signature = createHmac("sha256", getGoogleMailEnv().OAUTH_STATE_SECRET).update(body).digest("base64url");
  return `${body}.${signature}`;
}
export function verifyOAuthState(value: string): OAuthState | null {
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = createHmac("sha256", getGoogleMailEnv().OAUTH_STATE_SECRET).update(body).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  const state = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
  return state.expiresAt > Date.now() ? state : null;
}
