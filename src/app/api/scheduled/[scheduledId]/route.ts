import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { validateComposeInput } from "@/lib/mail/compose-validation";
import { requireScheduledIdentity, resolveScheduledProject } from "@/lib/scheduling/access";
import { scheduledEditSchema, scheduledMutationSchema, validateScheduleTiming } from "@/lib/scheduling/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

async function context(request: NextRequest, scheduledId: string) {
  const owner = await getOwnerContext();
  if (!owner) return { response: NextResponse.json({ error: "Please sign in to continue." }, { status: 401 }) };
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return { response: NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 }) };
  const id = z.string().uuid().safeParse(scheduledId);
  if (!id.success) return { response: NextResponse.json({ error: "Scheduled email not found." }, { status: 404 }) };
  const { data: message, error } = await owner.database.from("scheduled_messages").select("*").eq("id", id.data).eq("owner_id", owner.user.id).maybeSingle();
  if (error || !message) return { response: NextResponse.json({ error: "Scheduled email not found." }, { status: 404 }) };
  return { owner, message };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ scheduledId: string }> }) {
  try {
    const resolved = await params;
    const loaded = await context(request, resolved.scheduledId);
    if ("response" in loaded) return loaded.response;
    const { owner, message } = loaded;
    if (message.status !== "SCHEDULED") throw new ValidationError("This email can no longer be edited.");
    const body = scheduledEditSchema.parse(await request.json());
    if (body.version !== message.version) return NextResponse.json({ error: "This schedule changed in another session. Refresh and try again." }, { status: 409 });
    const input = validateComposeInput({ from: body.from, to: body.to, cc: body.cc, bcc: body.bcc, subject: body.subject, body: body.body });
    if (!input) throw new ValidationError("Check the sender, recipients, subject, and message body.");
    const identity = await requireScheduledIdentity(owner.database, owner.user.id, input.from);
    const projectId = await resolveScheduledProject(owner.database, owner.user.id, body.projectId || null, message.provider_thread_id ?? undefined);
    const database = createSupabaseAdminClient();
    const { data: updated, error } = await database.from("scheduled_messages").update({
      mail_account_id: identity.id,
      project_id: projectId,
      to_addresses: input.to,
      cc_addresses: input.cc,
      bcc_addresses: input.bcc,
      subject: input.subject,
      text_body: input.body,
      version: message.version + 1,
      updated_at: new Date().toISOString()
    }).eq("id", message.id).eq("owner_id", owner.user.id).eq("status", "SCHEDULED").eq("version", message.version).select("id, version").maybeSingle();
    if (error || !updated) return NextResponse.json({ error: "This email is already being processed or changed." }, { status: 409 });
    return NextResponse.json({ updated: true, version: updated.version });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.code === "VALIDATION" ? safe.safeMessage : "The scheduled email could not be updated." }, { status: safe.code === "VALIDATION" ? 400 : 503 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ scheduledId: string }> }) {
  try {
    const resolved = await params;
    const loaded = await context(request, resolved.scheduledId);
    if ("response" in loaded) return loaded.response;
    const { owner, message } = loaded;
    const mutation = scheduledMutationSchema.parse(await request.json());
    if (mutation.action === "cancel" && message.status === "CANCELLED") return NextResponse.json({ cancelled: true, version: message.version });
    if (mutation.version !== message.version) return NextResponse.json({ error: "This schedule changed in another session. Refresh and try again." }, { status: 409 });
    const database = createSupabaseAdminClient();

    if (mutation.action === "cancel") {
      if (message.status !== "SCHEDULED") throw new ValidationError("This email can no longer be cancelled.");
      const { data, error } = await database.from("scheduled_messages").update({ status: "CANCELLED", cancelled_at: new Date().toISOString(), version: message.version + 1, updated_at: new Date().toISOString() }).eq("id", message.id).eq("owner_id", owner.user.id).eq("status", "SCHEDULED").eq("version", message.version).select("version").maybeSingle();
      if (error || !data) return NextResponse.json({ error: "This email is already being processed or changed." }, { status: 409 });
      return NextResponse.json({ cancelled: true, version: data.version });
    }

    if (mutation.action === "reschedule") {
      if (message.status !== "SCHEDULED") throw new ValidationError("This email can no longer be rescheduled.");
      const timing = validateScheduleTiming({ scheduledFor: mutation.scheduledFor, timezone: mutation.timezone });
      if (!timing) throw new ValidationError("Choose a valid future delivery date and time.");
      const { data, error } = await database.from("scheduled_messages").update({ scheduled_for: timing.scheduledFor, next_attempt_at: timing.scheduledFor, timezone: timing.timezone, attempt_count: 0, last_error_code: null, last_error_message: null, version: message.version + 1, updated_at: new Date().toISOString() }).eq("id", message.id).eq("owner_id", owner.user.id).eq("status", "SCHEDULED").eq("version", message.version).select("version").maybeSingle();
      if (error || !data) return NextResponse.json({ error: "This email is already being processed or changed." }, { status: 409 });
      return NextResponse.json({ rescheduled: true, version: data.version });
    }

    if (message.status !== "FAILED") throw new ValidationError("Only a failed scheduled email can be retried.");
    const identity = await owner.database.from("mail_accounts").select("id").eq("id", message.mail_account_id).eq("owner_id", owner.user.id).eq("is_active", true).eq("send_as_state", "available").maybeSingle();
    if (identity.error || !identity.data) throw new ValidationError("Reconnect or restore the approved sender before retrying.");
    const now = new Date().toISOString();
    const { data, error } = await database.from("scheduled_messages").update({ status: "SCHEDULED", scheduled_for: now, next_attempt_at: now, attempt_count: 0, processing_token: null, claimed_at: null, last_error_code: null, last_error_message: null, version: message.version + 1, updated_at: now }).eq("id", message.id).eq("owner_id", owner.user.id).eq("status", "FAILED").eq("version", message.version).select("version").maybeSingle();
    if (error || !data) return NextResponse.json({ error: "This email is already being processed or changed." }, { status: 409 });
    return NextResponse.json({ retryQueued: true, version: data.version });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.code === "VALIDATION" ? safe.safeMessage : "The schedule could not be changed." }, { status: safe.code === "VALIDATION" ? 400 : 503 });
  }
}
