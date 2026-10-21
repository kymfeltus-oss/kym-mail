import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { MAX_ATTACHMENT_COUNT, validateAttachmentEntries, validateAttachmentFiles } from "@/lib/mail/attachment-validation";
import { validateComposeInput } from "@/lib/mail/compose-validation";
import { loadInlineEmailLogo } from "@/lib/mail/inline-email-assets";
import { buildPixelPerfectEmailHtml, buildProfessionalEmailHtml, defaultEmailLookForSender, isEmailLook, pixelPerfectAccessibleText } from "@/lib/mail/professional-html";
import { emailDesignContentId, emailDesignFilename, validPngFile } from "@/lib/mail/email-design-constants";
import { createEmailDesignShare, hasPngSignature, removeEmailDesignShareByHash, type EmailDesignShare } from "@/lib/mail/email-design-share";
import { loadForwardedAttachments, parseForwardAttachmentIds } from "@/lib/mail/forwarded-attachments";
import { loadGoogleProvider, syncGmailMessageById } from "@/lib/mail/gmail-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { composeAttachmentBucket } from "@/lib/scheduling/constants";
import { loadStagedAttachments, parseStagedAttachmentRefs } from "@/lib/mail/staged-attachments";
import { appendDriveLinkSection, parseDriveFileIds, shareDriveFilesForEmail } from "@/lib/mail/drive-link-attachments";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  const stagedPaths: string[] = [];
  let database: ReturnType<typeof createSupabaseAdminClient> | null = null;
  let emailDesignShare: EmailDesignShare | null = null;
  let deliveryCompleted = false;
  try {
    const form = await request.formData();
    database = createSupabaseAdminClient();
    const stagedRefs = parseStagedAttachmentRefs(form.get("uploadedAttachments"), owner.user.id);
    stagedPaths.push(...stagedRefs.map((ref) => ref.path));
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
    const forwardAttachmentIds = parseForwardAttachmentIds(form.getAll("forwardAttachmentIds"));
    if (!forwardAttachmentIds) throw new ValidationError("The forwarded attachment selection is invalid.");
    const driveFileIds = parseDriveFileIds(form.get("driveFileIds"));
    if (!driveFileIds) throw new ValidationError("The large-file selection is invalid.");

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

    const { provider } = await loadGoogleProvider(database, identity.mail_connection_id);
    const uploadedAttachments = [
      ...await loadStagedAttachments(database, stagedRefs),
      ...await Promise.all(files.map(async (file) => ({ filename: file.name, mimeType: file.type || "application/octet-stream", content: new Uint8Array(await file.arrayBuffer()) })))
    ];
    if (!validateAttachmentEntries(uploadedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.content.byteLength })))) {
      throw new ValidationError("The combined attachments are unsupported, too large, or too numerous.");
    }
    const forwardedAttachments = await loadForwardedAttachments(
      database,
      owner.user.id,
      identity.mail_connection_id,
      forwardAttachmentIds,
      uploadedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.content.byteLength }))
    );
    if (driveFileIds.length + forwardedAttachments.length + uploadedAttachments.length > MAX_ATTACHMENT_COUNT) {
      throw new ValidationError(`Add no more than ${MAX_ATTACHMENT_COUNT} files to one email.`);
    }
    const sharedDriveFiles = await shareDriveFilesForEmail(provider, owner.user.id, identity.mail_connection_id, driveFileIds);
    const body = appendDriveLinkSection(input.body, sharedDriveFiles);
    const rawLook = form.get("emailLook");
    const look = isEmailLook(rawLook) ? rawLook : defaultEmailLookForSender(input.from);
    const pixelPerfect = form.get("renderMode") === "pixel-perfect";
    const pixelImageFile = form.get("pixelPerfectImage");
    if (pixelPerfect && !validPngFile(pixelImageFile)) throw new ValidationError("The Pixel Perfect image could not be prepared. Choose Standard HTML or try again.");
    const pixelImage = pixelPerfect && validPngFile(pixelImageFile) ? new Uint8Array(await pixelImageFile.arrayBuffer()) : null;
    if (pixelImage && !hasPngSignature(pixelImage)) throw new ValidationError("The Pixel Perfect image is invalid. Try again or choose Standard HTML.");
    if (pixelImage && !validateAttachmentEntries([
      ...driveFileIds.map((_, index) => ({ name: `drive-link-${index + 1}`, size: 1 })),
      ...forwardedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.content.byteLength })),
      ...uploadedAttachments.map((attachment) => ({ name: attachment.filename, size: attachment.content.byteLength })),
      { name: emailDesignFilename, size: pixelImage.byteLength }
    ])) throw new ValidationError("Pixel Perfect adds an image to the 18 MB message limit. Remove attachments or choose Standard HTML.");
    const accessibleText = pixelPerfectAccessibleText(input.from, body, look);
    if (pixelImage) {
      const baseUrl = process.env.APP_URL?.trim() || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : request.nextUrl.origin);
      emailDesignShare = await createEmailDesignShare({ database, ownerId: owner.user.id, image: pixelImage, subject: input.subject, from: input.from, textBody: accessibleText, baseUrl });
    }
    const inlineImages = pixelImage
      ? [{ contentId: emailDesignContentId, filename: emailDesignFilename, mimeType: "image/png", content: pixelImage }]
      : await loadInlineEmailLogo(look);
    const textBody = emailDesignShare ? `${accessibleText}\n\nView the full design: ${emailDesignShare.url}` : body;
    const htmlBody = emailDesignShare
      ? buildPixelPerfectEmailHtml({ imageSource: `cid:${emailDesignContentId}`, imageAlt: `Subject: ${input.subject}. Message text: ${accessibleText.slice(0, 4000)}`, viewUrl: emailDesignShare.url })
      : buildProfessionalEmailHtml({ from: input.from, subject: input.subject, body, look, logoImageSource: inlineImages[0] ? `cid:${inlineImages[0].contentId}` : undefined });
    const result = await provider.send({
      from: input.from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      subject: input.subject,
      textBody,
      htmlBody,
      threadId: input.providerThreadId,
      replyToMessageId: input.replyToMessageId,
      inlineImages,
      attachments: [...forwardedAttachments, ...uploadedAttachments]
    });
    deliveryCompleted = true;

    let synchronized = true;
    try { await syncGmailMessageById(database, identity.mail_connection_id, result.messageId, projectId); }
    catch { synchronized = false; }
    log("info", "mail.message_sent", { mailConnectionId: identity.mail_connection_id, synchronized, attachmentCount: uploadedAttachments.length + forwardedAttachments.length, driveLinkCount: sharedDriveFiles.length, projectAssociated: Boolean(projectId), forwardedAttachmentCount: forwardedAttachments.length });
    return NextResponse.json({ sent: true, synchronized, messageId: result.messageId, threadId: result.threadId }, { status: synchronized ? 200 : 202 });
  } catch (error) {
    if (emailDesignShare && !deliveryCompleted) {
      try { if (database) await removeEmailDesignShareByHash(database, emailDesignShare.tokenHash); } catch { /* The unguessable share remains access-limited and expires. */ }
    }
    const safeError = toSafeError(error);
    log("error", "mail.message_send_failed", { code: safeError.code });
    const validationFailure = error instanceof z.ZodError || safeError.code === "VALIDATION";
    return NextResponse.json({ error: safeError.safeMessage }, { status: validationFailure ? 400 : safeError.code === "UNAUTHORIZED" ? 401 : 503 });
  } finally {
    if (database && stagedPaths.length) {
      const { error } = await database.storage.from(composeAttachmentBucket).remove(stagedPaths);
      if (error) log("error", "mail.attachment_cleanup_failed", { attachmentCount: stagedPaths.length });
    }
  }
}
