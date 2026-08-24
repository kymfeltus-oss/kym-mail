import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleMailProvider } from "./google-mail-provider";
import { encryptToken } from "@/lib/mail/token-crypto";

function configureGoogleEnvironment() {
  vi.stubEnv("GOOGLE_CLIENT_ID", "google-client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "google-client-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "http://localhost:3000/api/oauth/google/callback");
  vi.stubEnv("GOOGLE_CLOUD_PROJECT_ID", "kym-mail");
  vi.stubEnv("GMAIL_PUBSUB_TOPIC", "projects/kym-mail/topics/kym-mail-gmail");
  vi.stubEnv("GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT", "push@kym-mail.iam.gserviceaccount.com");
  vi.stubEnv("GMAIL_PUBSUB_AUDIENCE", "https://www.kymmailapp.com/api/webhooks/gmail");
  vi.stubEnv("OAUTH_STATE_SECRET", "a-long-oauth-state-test-secret");
  vi.stubEnv("MAIL_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("APP_URL", "http://localhost:3000");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GoogleMailProvider authorization recovery", () => {
  it("moves a connection to reauth_required when refresh authorization is denied", async () => {
    configureGoogleEnvironment();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })));
    const updates: Array<{ table: string; value: Record<string, unknown> }> = [];
    const database = {
      from(table: string) {
        return {
          update(value: Record<string, unknown>) {
            return {
              async eq() {
                updates.push({ table, value });
                return { error: null };
              }
            };
          }
        };
      }
    } as unknown as SupabaseClient;
    const provider = new GoogleMailProvider({
      id: "connection-id",
      encrypted_access_token: null,
      encrypted_refresh_token: encryptToken("refresh-token"),
      token_expires_at: null
    }, database);

    await expect(provider.getProfile()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      safeMessage: "Reconnect this mail account to continue."
    });
    expect(updates).toContainEqual({
      table: "mail_connections",
      value: expect.objectContaining({
        connection_state: "reauth_required",
        sync_error: "Authorization must be renewed."
      })
    });
  });
});
