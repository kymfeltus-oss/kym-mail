import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError } from "@/lib/errors";
import { cancelOutreachSequence } from "@/lib/mail/outreach";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ sequenceId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const id = z.string().uuid().safeParse((await params).sequenceId);
  if (!id.success) return NextResponse.json({ error: "Follow-up sequence not found." }, { status: 404 });
  try {
    const body = z.object({ action: z.literal("do_not_contact") }).safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Choose do not contact to stop this sequence." }, { status: 400 });
    const stopped = await cancelOutreachSequence(createSupabaseAdminClient(), owner.user.id, id.data);
    if (!stopped) return NextResponse.json({ error: "That sequence is no longer active." }, { status: 409 });
    return NextResponse.json({ stopped: true });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.safeMessage }, { status: 503 });
  }
}
