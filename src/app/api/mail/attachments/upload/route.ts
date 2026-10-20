import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { MAX_ATTACHMENT_COUNT, validateAttachmentEntries } from "@/lib/mail/attachment-validation";
import { composeAttachmentBucket } from "@/lib/scheduling/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isOwnedComposeAttachmentPath } from "@/lib/mail/staged-attachments";

export const runtime = "nodejs";

const uploadRequestSchema = z.object({
  files: z.array(z.object({
    name: z.string().trim().min(1).max(255),
    size: z.number().int().positive(),
    type: z.string().max(255)
  })).max(MAX_ATTACHMENT_COUNT)
});

const cleanupRequestSchema = z.object({ paths: z.array(z.string().min(1).max(200)).max(MAX_ATTACHMENT_COUNT) });

function allowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function attachmentLimitMessage() {
  return "Attachments must be safe file types, up to 18 MB each, with a combined limit of 18 MB and a maximum of 25 files.";
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!allowedOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const parsed = uploadRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("The attachment selection is invalid.");
    const files = parsed.data.files;
    if (!validateAttachmentEntries(files.map(({ name, size }) => ({ name, size })))) throw new ValidationError(attachmentLimitMessage());

    const storage = createSupabaseAdminClient().storage.from(composeAttachmentBucket);
    const uploads = await Promise.all(files.map(async () => {
      const path = `${owner.user.id}/compose/${crypto.randomUUID()}`;
      const { data, error } = await storage.createSignedUploadUrl(path, { upsert: false });
      if (error || !data) throw new Error("SIGNED_UPLOAD_URL_UNAVAILABLE");
      return { path, token: data.token };
    }));
    return NextResponse.json({ uploads });
  } catch (error) {
    const safeError = toSafeError(error);
    const validationFailure = error instanceof z.ZodError || safeError.code === "VALIDATION";
    log("error", "mail.attachment_upload_prepare_failed", { code: safeError.code });
    return NextResponse.json({ error: validationFailure ? safeError.safeMessage : "The attachments could not be prepared for upload." }, { status: validationFailure ? 400 : 503 });
  }
}

export async function DELETE(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!allowedOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const parsed = cleanupRequestSchema.safeParse(await request.json());
    if (!parsed.success || parsed.data.paths.some((path) => !isOwnedComposeAttachmentPath(path, owner.user.id))) {
      throw new ValidationError("The attachment cleanup request is invalid.");
    }
    if (parsed.data.paths.length) {
      const { error } = await createSupabaseAdminClient().storage.from(composeAttachmentBucket).remove(parsed.data.paths);
      if (error) throw new Error("ATTACHMENT_CLEANUP_FAILED");
    }
    return NextResponse.json({ removed: true });
  } catch (error) {
    const safeError = toSafeError(error);
    const validationFailure = error instanceof z.ZodError || safeError.code === "VALIDATION";
    log("error", "mail.attachment_cleanup_failed", { code: safeError.code });
    return NextResponse.json({ error: validationFailure ? safeError.safeMessage : "The temporary attachments could not be cleared." }, { status: validationFailure ? 400 : 503 });
  }
}
