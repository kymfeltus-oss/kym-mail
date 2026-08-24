import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { validateAttachmentFiles } from "@/lib/mail/attachment-validation";
import { validateComposeInput } from "@/lib/mail/compose-validation";
import { loadGoogleProvider, syncGmailMessageById } from "@/lib/mail/gmail-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const form = await request.formData();
    const rawProjectId = form.get("projectId");
    const projectId = typeof rawProjectId === "string" && rawProjectId ? z.string().uuid().parse(rawProjectId) : null;
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

    const files = form.getAll("attachments").filter((entry): entry is File => entry instanceof File && entry.size > 0);
    if (!validateAttachmentFiles(files)) {
      throw new ValidationError("One or more attachments are unsupported or too large.");
    }

    const { data: identity, error: identityError } = await owner.database.from("mail_accounts")
      .select("id, mail_connection_id")
      .eq("owner_id", owner.user.id)
      .eq("email_address", input.from)
      .eq("is_active", true)
      .eq("send_as_state", "available")
      .single();
    if (identityError || !identity?.mail_connection_id) throw new ValidationError("The selected sender is not available through Google Mail.");

    if (projectId) {
      const { data: project, error: projectError } = await owner.database
        .from("projects")
        .select("id")
        .eq("id", projectId)
        .eq("owner_id", owner.user.id)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (projectError || !project) throw new ValidationError("Select an active Project or choose None.");
    }

    const database = createSupabaseAdminClient();
    const { provider } = await loadGoogleProvider(database, identity.mail_connection_id);
    const result = await provider.send({
      from: input.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      textBody: input.body,
      threadId: input.providerThreadId,
      replyToMessageId: input.replyToMessageId,
      attachments: await Promise.all(files.map(async (file) => ({ filename: file.name, mimeType: file.type || "application/octet-stream", content: new Uint8Array(await file.arrayBuffer()) })))
    });

    let synchronized = true;
    try { await syncGmailMessageById(database, identity.mail_connection_id, result.messageId, projectId); }
    catch { synchronized = false; }
    log("info", "mail.message_sent", { mailConnectionId: identity.mail_connection_id, synchronized, attachmentCount: files.length, projectAssociated: Boolean(projectId) });
    return NextResponse.json({ sent: true, synchronized, messageId: result.messageId, threadId: result.threadId }, { status: synchronized ? 200 : 202 });
  } catch (error) {
    const safeError = toSafeError(error);
    log("error", "mail.message_send_failed", { code: safeError.code });
    const validationFailure = error instanceof z.ZodError || safeError.code === "VALIDATION";
    return NextResponse.json({ error: validationFailure ? "Select a valid Project and check the message details." : safeError.safeMessage }, { status: validationFailure ? 400 : safeError.code === "UNAUTHORIZED" ? 401 : 503 });
  }
}
