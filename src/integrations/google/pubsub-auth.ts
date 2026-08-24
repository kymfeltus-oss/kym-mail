import { OAuth2Client, type TokenPayload } from "google-auth-library";

const googleOAuthClient = new OAuth2Client();
const GOOGLE_ISSUERS = new Set(["accounts.google.com", "https://accounts.google.com"]);

export function getBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

export function hasExpectedPubSubClaims(payload: TokenPayload, serviceAccountEmail: string, audience: string): boolean {
  return (
    payload.aud === audience &&
    payload.email?.toLowerCase() === serviceAccountEmail.toLowerCase() &&
    payload.email_verified === true &&
    typeof payload.iss === "string" &&
    GOOGLE_ISSUERS.has(payload.iss)
  );
}

export async function verifyPubSubAuthorization(
  authorization: string | null,
  serviceAccountEmail: string,
  audience: string
): Promise<boolean> {
  const token = getBearerToken(authorization);
  if (!token) return false;

  try {
    const ticket = await googleOAuthClient.verifyIdToken({ idToken: token, audience });
    const payload = ticket.getPayload();
    return Boolean(payload && hasExpectedPubSubClaims(payload, serviceAccountEmail, audience));
  } catch {
    return false;
  }
}
