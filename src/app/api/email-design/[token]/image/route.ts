import { NextResponse } from "next/server";
import { emailDesignShareBucket } from "@/lib/mail/email-design-constants";
import { findEmailDesignShareByToken } from "@/lib/mail/email-design-share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = createSupabaseAdminClient();
  const share = await findEmailDesignShareByToken(database, token);
  if (!share) return NextResponse.json({ error: "This email design link has expired or is unavailable." }, { status: 404 });

  const { data, error } = await database.storage.from(emailDesignShareBucket).download(share.object_path);
  if (error || !data) return NextResponse.json({ error: "This email design image is unavailable." }, { status: 404 });
  return new Response(new Uint8Array(await data.arrayBuffer()), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": "inline; filename=\"kym-mail-email-design.png\"",
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}
