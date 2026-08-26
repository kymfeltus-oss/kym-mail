import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ shareId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { shareId } = await params;
  if (!z.string().uuid().safeParse(shareId).success) return NextResponse.json({ error: "Share link not found." }, { status: 404 });
  const { data, error } = await owner.database.from("resume_shares").update({ status: "REVOKED", revoked_at: new Date().toISOString() }).eq("id", shareId).eq("owner_id", owner.user.id).eq("status", "ACTIVE").select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Share link could not be revoked." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Active share link not found." }, { status: 404 });
  return NextResponse.json({ status: "REVOKED" });
}
