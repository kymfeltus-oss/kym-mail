import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSchedulerEnv } from "@/lib/env";
import { toSafeError } from "@/lib/errors";
import { syncStaleGmailConnections } from "@/lib/mail/gmail-sync";
import { log } from "@/lib/logger";
import { executeDueScheduledMessages } from "@/lib/scheduling/executor";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function authorized(request: NextRequest, secret: string) {
  const received = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  let secret: string;
  try { secret = getSchedulerEnv().CRON_SECRET; }
  catch { return Response.json({ error: "Scheduled delivery is not configured." }, { status: 503 }); }
  if (!authorized(request, secret)) return Response.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const database = createSupabaseAdminClient();
    const [scheduledResult, gmailResult] = await Promise.allSettled([
      executeDueScheduledMessages(database),
      syncStaleGmailConnections(database)
    ]);
    if (scheduledResult.status === "rejected") return Response.json({ error: "Scheduled delivery execution failed safely." }, { status: 503 });
    if (gmailResult.status === "rejected") log("error", "mail.gmail_cron_catchup_failed", { reason: toSafeError(gmailResult.reason).code });
    return Response.json({
      ok: true,
      result: scheduledResult.value,
      gmailCatchup: gmailResult.status === "fulfilled" ? gmailResult.value : { error: "Gmail catch-up could not run." }
    });
  } catch {
    return Response.json({ error: "Scheduled delivery execution failed safely." }, { status: 503 });
  }
}
