import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getGoogleMailEnv } from "@/lib/env";
import { signOAuthState } from "@/lib/mail/oauth-state";

export async function GET(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.redirect(new URL("/sign-in", request.url));
  const { data: existingConnection, error: lookupError } = await owner.database
    .from("mail_connections")
    .select("id")
    .eq("owner_id", owner.user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (lookupError) return NextResponse.redirect(new URL("/app?mailError=connection_lookup", request.url));

  let connection = existingConnection;
  if (!connection) {
    const { data, error } = await owner.database
      .from("mail_connections")
      .insert({ owner_id: owner.user.id, provider: "google", connection_state: "connecting" })
      .select("id")
      .single();
    if (error || !data) return NextResponse.redirect(new URL("/app?mailError=connection_create", request.url));
    connection = data;
  }

  const env = getGoogleMailEnv(); const nonce = randomUUID();
  const state = signOAuthState({ ownerId: owner.user.id, mailConnectionId: connection.id, nonce, expiresAt: Date.now() + 10 * 60_000 });
  const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_REDIRECT_URI, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: "https://www.googleapis.com/auth/gmail.modify", state });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("kym_google_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/api/oauth/google/callback" });
  await owner.database.from("mail_connections").update({ connection_state: "connecting", sync_error: null, updated_at: new Date().toISOString() }).eq("id", connection.id).eq("owner_id", owner.user.id);
  return response;
}
