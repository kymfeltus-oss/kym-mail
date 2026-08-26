import { NextResponse } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { consultationProofBucket } from "@/lib/consultations/proof";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(_: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) return NextResponse.json({ error: "Payment proof not found." }, { status: 404 });
  const { data: record } = await owner.database.from("consultation_requests").select("proof_object_path, proof_filename, proof_mime_type").eq("id", requestId).eq("owner_id", owner.user.id).maybeSingle();
  if (!record) return NextResponse.json({ error: "Payment proof not found." }, { status: 404 });
  const database = createSupabaseAdminClient();
  const { data, error } = await database.storage.from(consultationProofBucket).download(record.proof_object_path);
  if (error || !data) return NextResponse.json({ error: "Payment proof is unavailable." }, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), { headers: { "content-type": record.proof_mime_type, "content-disposition": `inline; filename="${record.proof_filename.replace(/["\\]/g, "-")}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
}
