import { NextResponse, type NextRequest } from "next/server";
import { verifyPubSubAuthorization } from "@/integrations/google/pubsub-auth";
import { getGoogleMailEnv } from "@/lib/env";
import { toSafeError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { syncGmailConnection } from "@/lib/mail/gmail-sync";
import { parseGmailPushNotification } from "@/lib/mail/pubsub";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_NOTIFICATION_BYTES = 16_384;

export async function POST(request: NextRequest) {
  const env = getGoogleMailEnv();
  const authorized = await verifyPubSubAuthorization(
    request.headers.get("authorization"),
    env.GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT,
    env.GMAIL_PUBSUB_AUDIENCE
  );
  if (!authorized) {
    log("warn", "mail.gmail_webhook_unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_NOTIFICATION_BYTES) {
    return NextResponse.json({ error: "Invalid notification" }, { status: 413 });
  }

  const payload = await request.json().catch(() => null);
  const notification = parseGmailPushNotification(payload);
  if (!notification) return NextResponse.json({ error: "Invalid notification" }, { status: 400 });

  const database = createSupabaseAdminClient();
  const { data: connection, error: connectionError } = await database
    .from("mail_connections")
    .select("id")
    .eq("provider", "google")
    .eq("provider_account_id", notification.providerEmail)
    .maybeSingle();

  if (connectionError) {
    log("error", "mail.gmail_webhook_connection_lookup_failed", { providerEmail: notification.providerEmail });
    return NextResponse.json({ error: "Notification unavailable" }, { status: 503 });
  }

  const processingError = connection ? null : "No connected mail provider matches this notification.";
  const { error: notificationError } = await database.from("gmail_notifications").upsert(
    {
      deduplication_key: notification.deduplicationKey,
      mail_connection_id: connection?.id ?? null,
      provider_email: notification.providerEmail,
      history_id: notification.historyId,
      processing_error: processingError
    },
    { onConflict: "deduplication_key", ignoreDuplicates: true }
  );

  if (notificationError) {
    log("error", "mail.gmail_webhook_persist_failed", { pubSubMessageId: notification.pubSubMessageId });
    return NextResponse.json({ error: "Notification unavailable" }, { status: 503 });
  }

  if (connection) {
    try {
      await syncGmailConnection(database, connection.id);
      await database.from("gmail_notifications").update({
        processed_at: new Date().toISOString(),
        processing_error: null
      }).eq("deduplication_key", notification.deduplicationKey);
    } catch (error) {
      const safeError = toSafeError(error);
      await database.from("gmail_notifications").update({ processing_error: safeError.safeMessage }).eq("deduplication_key", notification.deduplicationKey);
      await database.from("mail_connections").update({ sync_error: safeError.safeMessage, updated_at: new Date().toISOString() }).eq("id", connection.id);
      log("error", "mail.gmail_notification_processing_failed", { mailConnectionId: connection.id, code: safeError.code, pubSubMessageId: notification.pubSubMessageId });
      return NextResponse.json({ error: "Notification unavailable" }, { status: 503 });
    }
  }

  log("info", connection ? "mail.gmail_notification_received" : "mail.gmail_notification_unmatched", {
    mailConnectionId: connection?.id,
    providerEmail: notification.providerEmail,
    pubSubMessageId: notification.pubSubMessageId
  });
  return new NextResponse(null, { status: 204 });
}
