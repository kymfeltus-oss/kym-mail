import { NextResponse } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { loadGoogleProvider } from "@/lib/mail/gmail-sync";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 60;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

export async function GET(_request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const { attachmentId } = await params;
    const { data: attachment, error: attachmentError } = await owner.database.from("mail_attachments")
      .select("id, message_id, provider_attachment_id, filename, mime_type, size_bytes")
      .eq("id", attachmentId)
      .eq("owner_id", owner.user.id)
      .maybeSingle();
    if (attachmentError || !attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
    if (Number(attachment.size_bytes) > MAX_DOWNLOAD_BYTES || attachment.provider_attachment_id.startsWith("inline:")) throw new ValidationError("This attachment cannot be downloaded safely.");
    const { data: message, error: messageError } = await owner.database.from("mail_messages")
      .select("provider_message_id, mail_connection_id")
      .eq("id", attachment.message_id)
      .eq("owner_id", owner.user.id)
      .single();
    if (messageError || !message) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });

    const database = createSupabaseAdminClient();
    const { provider } = await loadGoogleProvider(database, message.mail_connection_id);
    const result = await provider.getAttachment(message.provider_message_id, attachment.provider_attachment_id);
    const content = Buffer.from(result.data, "base64url");
    if (content.byteLength > MAX_DOWNLOAD_BYTES) throw new ValidationError("This attachment is too large to download.");
    const filename = attachment.filename.replace(/[\r\n"\\/]/g, "_") || "attachment";
    return new NextResponse(content, {
      headers: {
        "content-type": attachment.mime_type || "application/octet-stream",
        "content-disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "content-length": String(content.byteLength),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff"
      }
    });
  } catch (error) {
    const safe = toSafeError(error);
    return NextResponse.json({ error: safe.safeMessage }, { status: safe.code === "VALIDATION" ? 400 : 503 });
  }
}

