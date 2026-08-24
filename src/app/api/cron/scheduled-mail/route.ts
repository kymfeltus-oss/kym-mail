import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { getSchedulerEnv } from "@/lib/env";
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
    return Response.json({ ok: true, result: await executeDueScheduledMessages(createSupabaseAdminClient()) });
  } catch {
    return Response.json({ error: "Scheduled delivery execution failed safely." }, { status: 503 });
  }
}
