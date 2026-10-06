import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { safeResumeFilename } from "@/lib/resumes/format";
import { renderTargetResumeDocx, renderTargetResumePdf, targetExportStyleSchema, type TargetExportStyle } from "@/lib/resumes/target/export";
import { loadResumeTarget } from "@/lib/resumes/target/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const styleSchema = z.object({
  layout: z.enum(targetExportStyleSchema.layouts),
  color: z.enum(targetExportStyleSchema.colors),
  type: z.enum(targetExportStyleSchema.types),
  header: z.enum(targetExportStyleSchema.headers)
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ targetId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { targetId } = await params;
  if (!z.string().uuid().safeParse(targetId).success) return NextResponse.json({ error: "This targeted resume was not found." }, { status: 404 });
  const format = request.nextUrl.searchParams.get("format")?.toLowerCase();
  if (format !== "pdf" && format !== "docx") return NextResponse.json({ error: "Choose PDF or Word." }, { status: 422 });
  const parsedStyle = styleSchema.safeParse({
    layout: request.nextUrl.searchParams.get("layout") ?? "classic",
    color: request.nextUrl.searchParams.get("color") ?? "ink",
    type: request.nextUrl.searchParams.get("type") ?? "modern",
    header: request.nextUrl.searchParams.get("header") ?? "rule"
  });
  if (!parsedStyle.success) return NextResponse.json({ error: "Choose a layout, color, type, and header." }, { status: 422 });
  const target = await loadResumeTarget(owner.database, owner.user.id, targetId);
  if (!target?.currentVersion) return NextResponse.json({ error: "Write the résumé before downloading it." }, { status: 409 });
  const style: TargetExportStyle = parsedStyle.data;
  const buffer = format === "docx" ? await renderTargetResumeDocx(target.currentVersion.content, style) : await renderTargetResumePdf(target.currentVersion.content, style);
  const filename = safeResumeFilename(target.currentVersion.content.candidate.fullName, target.employer, target.title, format);
  const type = format === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf";
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
