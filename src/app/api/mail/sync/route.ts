import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { syncGmailConnection } from "@/lib/mail/gmail-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { data: connection, error: lookupError } = await owner.database
    .from("mail_connections")
    .select("id, initial_sync_completed_at")
    .eq("owner_id", owner.user.id)
    .eq("provider", "google")
    .maybeSingle();
  if (lookupError || !connection) return NextResponse.json({ error: "Connect Google Mail to synchronize messages." }, { status: 409 });

  const database = createSupabaseAdminClient();
  try {
    const forceInitial = new URL(request.url).searchParams.get("mode") === "initial";
    const result = await syncGmailConnection(database, connection.id, forceInitial || !connection.initial_sync_completed_at ? "initial" : "incremental");
    await database.from("gmail_notifications").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("mail_connection_id", connection.id).is("processed_at", null);
    return NextResponse.json({ result });
  } catch (error) {
    const safeError = toSafeError(error);
    await database.from("mail_connections").update({ sync_error: safeError.safeMessage, updated_at: new Date().toISOString() }).eq("id", connection.id);
    log("error", "mail.gmail_manual_sync_failed", { mailConnectionId: connection.id, code: safeError.code });
    return NextResponse.json({ error: safeError.safeMessage }, { status: safeError.code === "UNAUTHORIZED" ? 401 : 503 });
  }
}
