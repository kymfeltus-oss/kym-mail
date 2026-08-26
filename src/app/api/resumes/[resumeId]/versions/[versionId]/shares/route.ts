import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { createResumeShareToken, hashResumeShareToken } from "@/lib/resumes/shares";

const bodySchema = z.object({ label: z.string().trim().min(2).max(120).optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ resumeId: string; versionId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { resumeId, versionId } = await params;
  if (!z.string().uuid().safeParse(resumeId).success || !z.string().uuid().safeParse(versionId).success) return NextResponse.json({ error: "Approved resume version not found." }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Share request is invalid." }, { status: 422 });
  const { data: version, error } = await owner.database.from("tailored_resume_versions").select("id, status, approved_at").eq("id", versionId).eq("resume_id", resumeId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Share service is temporarily unavailable." }, { status: 503 });
  if (!version || version.status !== "APPROVED" || !version.approved_at) return NextResponse.json({ error: "Only an approved, current resume version can receive a new share link." }, { status: 409 });
  const token = createResumeShareToken();
  const tokenHash = hashResumeShareToken(token);
  const { data: share, error: shareError } = await owner.database.from("resume_shares").insert({ owner_id: owner.user.id, resume_version_id: version.id, token_hash: tokenHash, label: parsed.data.label ?? null }).select("id, label, status, created_at").single();
  if (shareError || !share) return NextResponse.json({ error: "Secure share link could not be created." }, { status: 503 });
  return NextResponse.json({ share: { id: share.id, label: share.label, status: share.status, createdAt: share.created_at }, url: `${request.nextUrl.origin}/resume/${token}` }, { headers: { "Cache-Control": "no-store" } });
}
