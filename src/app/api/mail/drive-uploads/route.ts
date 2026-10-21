import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError, ValidationError } from "@/lib/errors";
import { loadGoogleProvider } from "@/lib/mail/gmail-sync";
import { blockedAttachmentPattern } from "@/lib/mail/compose-validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_DRIVE_FILE_BYTES = 5 * 1024 ** 4;
const requestSchema = z.object({
  from: z.string().email().max(254),
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(255),
  size: z.number().int().positive().max(MAX_DRIVE_FILE_BYTES)
});

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ValidationError("Choose a valid file up to 5 TB.");
    const safeName = parsed.data.name.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (!safeName || blockedAttachmentPattern.test(safeName)) throw new ValidationError("This file type cannot be uploaded.");

    const { data: identity, error: identityError } = await owner.database.from("mail_accounts")
      .select("mail_connection_id")
      .eq("owner_id", owner.user.id)
      .eq("email_address", parsed.data.from.trim().toLowerCase())
      .eq("is_active", true)
      .eq("send_as_state", "available")
      .single();
    if (identityError || !identity?.mail_connection_id) throw new ValidationError("The selected sender is not available through Google Mail.");

    const { provider } = await loadGoogleProvider(createSupabaseAdminClient(), identity.mail_connection_id);
    const upload = await provider.startDriveUpload({ ...parsed.data, name: safeName, ownerId: owner.user.id });
    return NextResponse.json(upload, { headers: { "cache-control": "no-store, max-age=0" } });
  } catch (error) {
    const safeError = toSafeError(error);
    const status = safeError.code === "VALIDATION" ? 400 : safeError.code === "UNAUTHORIZED" ? 401 : 503;
    return NextResponse.json({ error: safeError.safeMessage }, { status });
  }
}
