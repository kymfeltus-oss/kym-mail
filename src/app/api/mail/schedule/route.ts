import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { attachmentSha256, validateAttachmentFiles } from "@/lib/mail/attachment-validation";
import { validateComposeInput } from "@/lib/mail/compose-validation";
import { requireScheduledIdentity, resolveScheduledProject } from "@/lib/scheduling/access";
import { scheduledAttachmentBucket, scheduledRfcMessageId } from "@/lib/scheduling/constants";
import { validateScheduleTiming } from "@/lib/scheduling/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;

function safeStorageName(filename: string) {
  return filename.normalize("NFKC").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(0, 120) || "attachment";
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  const database = createSupabaseAdminClient();
  const uploadedPaths: string[] = [];
  let scheduledId: string | null = null;
  try {
    const form = await request.formData();
    const input = validateComposeInput({
      from: form.get("from"),
      to: form.get("to"),
      cc: form.get("cc") ?? "",
      bcc: form.get("bcc") ?? "",
      subject: form.get("subject"),
      body: form.get("body"),
      providerThreadId: form.get("providerThreadId") || undefined,
      replyToMessageId: form.get("replyToMessageId") || undefined
    });
    if (!input) throw new ValidationError("Check the sender, recipients, subject, and message body.");
    const timing = validateScheduleTiming({ scheduledFor: form.get("scheduledFor"), timezone: form.get("timezone") });
    if (!timing) throw new ValidationError("Choose a valid future delivery date and time.");
    const rawProjectId = form.get("projectId");
    const requestedProjectId = typeof rawProjectId === "string" && rawProjectId ? z.string().uuid().parse(rawProjectId) : null;
    const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!validateAttachmentFiles(files)) throw new ValidationError("One or more attachments are unsupported or too large.");

    const identity = await requireScheduledIdentity(owner.database, owner.user.id, input.from);
    const projectId = await resolveScheduledProject(owner.database, owner.user.id, requestedProjectId, input.providerThreadId);
    scheduledId = crypto.randomUUID();
    const attachments = [] as Array<{ id: string; owner_id: string; scheduled_message_id: string; object_path: string; filename: string; mime_type: string; size_bytes: number; sha256: string }>;
    for (const file of files) {
      const content = new Uint8Array(await file.arrayBuffer());
      const attachmentId = crypto.randomUUID();
      const objectPath = `${owner.user.id}/${scheduledId}/${attachmentId}-${safeStorageName(file.name)}`;
      const { error: uploadError } = await database.storage.from(scheduledAttachmentBucket).upload(objectPath, content, { contentType: file.type || "application/octet-stream", upsert: false });
      if (uploadError) throw new ValidationError("An attachment could not be stored securely for scheduled delivery.");
      uploadedPaths.push(objectPath);
      attachments.push({ id: attachmentId, owner_id: owner.user.id, scheduled_message_id: scheduledId, object_path: objectPath, filename: file.name, mime_type: file.type || "application/octet-stream", size_bytes: file.size, sha256: attachmentSha256(content) });
    }

    const { error: messageError } = await database.from("scheduled_messages").insert({
      id: scheduledId,
      owner_id: owner.user.id,
      mail_account_id: identity.id,
      project_id: projectId,
      provider_thread_id: input.providerThreadId ?? null,
      reply_to_message_id: input.replyToMessageId ?? null,
      rfc_message_id: scheduledRfcMessageId(scheduledId),
      to_addresses: input.to,
      cc_addresses: input.cc,
      bcc_addresses: input.bcc,
      subject: input.subject,
      text_body: input.body,
      scheduled_for: timing.scheduledFor,
      next_attempt_at: timing.scheduledFor,
      timezone: timing.timezone
    });
    if (messageError) throw new Error("SCHEDULE_PERSISTENCE_FAILED");
    if (attachments.length) {
      const { error: attachmentError } = await database.from("scheduled_message_attachments").insert(attachments);
      if (attachmentError) throw new Error("SCHEDULE_ATTACHMENT_PERSISTENCE_FAILED");
    }
    log("info", "mail.schedule_created", { scheduledMessageId: scheduledId, attachmentCount: attachments.length, projectAssociated: Boolean(projectId) });
    return NextResponse.json({ scheduled: true, id: scheduledId }, { status: 201 });
  } catch (error) {
    if (scheduledId) await database.from("scheduled_messages").delete().eq("id", scheduledId);
    if (uploadedPaths.length) await database.storage.from(scheduledAttachmentBucket).remove(uploadedPaths);
    const safeError = toSafeError(error);
    const validationFailure = error instanceof z.ZodError || safeError.code === "VALIDATION";
    log("error", "mail.schedule_create_failed", { code: safeError.code });
    return NextResponse.json({ error: validationFailure ? safeError.safeMessage : "The email could not be scheduled." }, { status: validationFailure ? 400 : 503 });
  }
}
