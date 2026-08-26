import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { renderResumeDocx, renderResumePdf } from "@/lib/resumes/exports";
import { safeResumeFilename } from "@/lib/resumes/format";
import { resumeContentSchema } from "@/lib/resumes/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ resumeId: string; versionId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { resumeId, versionId } = await params;
  if (!z.string().uuid().safeParse(resumeId).success || !z.string().uuid().safeParse(versionId).success) return NextResponse.json({ error: "Resume version not found." }, { status: 404 });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
  const presentation = request.nextUrl.searchParams.get("presentation")?.toLowerCase() === "ats" ? "ATS" as const : "EXECUTIVE" as const;
  if (format !== "docx" && format !== "pdf") return NextResponse.json({ error: "Choose DOCX or PDF." }, { status: 422 });
  const { data: resume, error: resumeError } = await owner.database.from("tailored_resumes").select("id, job_opportunities(title, company_name)").eq("id", resumeId).eq("owner_id", owner.user.id).maybeSingle();
  const { data: version, error: versionError } = await owner.database.from("tailored_resume_versions").select("id, status, approved_at, content").eq("id", versionId).eq("resume_id", resumeId).eq("owner_id", owner.user.id).maybeSingle();
  if (resumeError || versionError) return NextResponse.json({ error: "Resume export is temporarily unavailable." }, { status: 503 });
  if (!resume || !version || !version.approved_at || !["APPROVED", "STALE"].includes(version.status)) return NextResponse.json({ error: "Only an approved resume snapshot can be exported." }, { status: 409 });
  const content = resumeContentSchema.parse(version.content);
  const job = Array.isArray(resume.job_opportunities) ? resume.job_opportunities[0] : resume.job_opportunities;
  const filename = safeResumeFilename(content.candidate.fullName, job?.company_name ?? content.target.employer, job?.title ?? content.target.jobTitle, format);
  const buffer = format === "docx" ? await renderResumeDocx(content) : await renderResumePdf(content, { presentation });
  await owner.database.from("tailored_resume_exports").insert({ owner_id: owner.user.id, resume_version_id: version.id, export_format: format.toUpperCase(), filename, content_sha256: createHash("sha256").update(buffer).digest("hex") });
  return new NextResponse(new Uint8Array(buffer), { status: 200, headers: { "Content-Type": format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
