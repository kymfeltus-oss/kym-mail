import { NextResponse, type NextRequest } from "next/server";
import { GoogleMailProvider } from "@/integrations/google/google-mail-provider";
import { getGoogleMailEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { verifyOAuthState } from "@/lib/mail/oauth-state";
import { encryptToken } from "@/lib/mail/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
};

type GmailProfile = { emailAddress: string; historyId: string };
type GmailSendAs = {
  sendAsEmail: string;
  verificationStatus?: "accepted" | "pending";
};

function redirectToApp(appUrl: string, parameter: string) {
  return NextResponse.redirect(`${appUrl.replace(/\/$/, "")}/app?${parameter}`);
}

export async function GET(request: NextRequest) {
  const env = getGoogleMailEnv();
  const state = verifyOAuthState(request.nextUrl.searchParams.get("state") ?? "");
  const nonce = request.cookies.get("kym_google_oauth_nonce")?.value;
  if (!state || !nonce || nonce !== state.nonce) return redirectToApp(env.APP_URL, "mailError=invalid_oauth_state");

  const database = createSupabaseAdminClient();
  if (request.nextUrl.searchParams.get("error")) {
    await database.from("mail_connections").update({
      connection_state: "disconnected",
      sync_error: "Google authorization was not completed.",
      updated_at: new Date().toISOString()
    }).eq("id", state.mailConnectionId).eq("owner_id", state.ownerId);
    return redirectToApp(env.APP_URL, "mailError=authorization_denied");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectToApp(env.APP_URL, "mailError=oauth_callback");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code"
    })
  });
  if (!tokenResponse.ok) {
    await database.from("mail_connections").update({
      connection_state: "error",
      sync_error: "Google authorization failed.",
      updated_at: new Date().toISOString()
    }).eq("id", state.mailConnectionId).eq("owner_id", state.ownerId);
    return redirectToApp(env.APP_URL, "mailError=oauth_exchange");
  }

  const tokens = await tokenResponse.json() as GoogleTokenResponse;
  const [{ data: existingCredentials }, profileResponse, sendAsResponse] = await Promise.all([
    database.from("mail_connection_credentials").select("encrypted_refresh_token").eq("mail_connection_id", state.mailConnectionId).maybeSingle(),
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${tokens.access_token}` } }),
    fetch("https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs", { headers: { authorization: `Bearer ${tokens.access_token}` } })
  ]);

  if (!profileResponse.ok) return redirectToApp(env.APP_URL, "mailError=profile_lookup");
  if (!sendAsResponse.ok) return redirectToApp(env.APP_URL, "mailError=send_as_lookup");
  const encryptedRefreshToken = tokens.refresh_token ? encryptToken(tokens.refresh_token) : existingCredentials?.encrypted_refresh_token;
  if (!encryptedRefreshToken) return redirectToApp(env.APP_URL, "mailError=missing_refresh_token");

  const profile = await profileResponse.json() as GmailProfile;
  const sendAs = await sendAsResponse.json() as { sendAs?: GmailSendAs[] };
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const encryptedAccessToken = encryptToken(tokens.access_token);

  const { error: credentialError } = await database.from("mail_connection_credentials").upsert({
    mail_connection_id: state.mailConnectionId,
    encrypted_access_token: encryptedAccessToken,
    encrypted_refresh_token: encryptedRefreshToken,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString()
  });
  if (credentialError) return redirectToApp(env.APP_URL, "mailError=credential_storage");

  const { error: connectionError } = await database.from("mail_connections").update({
    provider_account_id: profile.emailAddress.toLowerCase(),
    connection_state: "connected",
    granted_scopes: (tokens.scope ?? "").split(" ").filter(Boolean),
    sync_history_id: profile.historyId,
    sync_error: null,
    updated_at: new Date().toISOString()
  }).eq("id", state.mailConnectionId).eq("owner_id", state.ownerId);
  if (connectionError) return redirectToApp(env.APP_URL, "mailError=connection_storage");

  await database.from("mail_accounts").update({ mail_connection_id: null, send_as_state: "unavailable" }).eq("owner_id", state.ownerId);
  for (const identity of sendAs.sendAs ?? []) {
    await database.from("mail_accounts").update({
      mail_connection_id: state.mailConnectionId,
      send_as_state: identity.verificationStatus === "accepted" ? "available" : "unverified"
    }).eq("owner_id", state.ownerId).eq("email_address", identity.sendAsEmail.toLowerCase());
  }

  const provider = new GoogleMailProvider({
    id: state.mailConnectionId,
    encrypted_access_token: encryptedAccessToken,
    encrypted_refresh_token: encryptedRefreshToken,
    token_expires_at: expiresAt
  }, database);

  try {
    const watch = await provider.createWatch(env.GMAIL_PUBSUB_TOPIC);
    await database.from("mail_connections").update({
      sync_history_id: watch.historyId,
      watch_expires_at: watch.expiration.toISOString(),
      sync_error: null,
      updated_at: new Date().toISOString()
    }).eq("id", state.mailConnectionId);
  } catch {
    await database.from("mail_connections").update({
      sync_error: "Gmail notifications could not be activated.",
      updated_at: new Date().toISOString()
    }).eq("id", state.mailConnectionId);
    return redirectToApp(env.APP_URL, "mailError=watch_setup");
  }

  log("info", "mail.google_connected", { mailConnectionId: state.mailConnectionId });
  const response = redirectToApp(env.APP_URL, "mailConnected=true");
  response.cookies.delete("kym_google_oauth_nonce");
  return response;
}
