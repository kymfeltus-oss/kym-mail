import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { scheduledAttachmentBucket } from "@/lib/scheduling/constants";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ scheduledId: string; attachmentId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const parsed = z.object({ scheduledId: z.string().uuid(), attachmentId: z.string().uuid() }).safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const { data: attachment, error } = await owner.database.from("scheduled_message_attachments")
    .select("id, object_path, filename, mime_type")
    .eq("id", parsed.data.attachmentId)
    .eq("scheduled_message_id", parsed.data.scheduledId)
    .eq("owner_id", owner.user.id)
    .maybeSingle();
  if (error || !attachment) return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  const { data, error: downloadError } = await createSupabaseAdminClient().storage.from(scheduledAttachmentBucket).download(attachment.object_path);
  if (downloadError || !data) return NextResponse.json({ error: "Attachment is unavailable." }, { status: 404 });
  const filename = attachment.filename.replace(/[\r\n"\\]/g, "_");
  return new Response(await data.arrayBuffer(), { headers: { "content-type": attachment.mime_type, "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
}
