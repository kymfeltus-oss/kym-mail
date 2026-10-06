import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { TargetResumeError } from "@/lib/resumes/target/generate";
import { saveResumeTargetProjects } from "@/lib/resumes/target/store";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ targetId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { targetId } = await params;
  if (!z.string().uuid().safeParse(targetId).success) return NextResponse.json({ error: "This targeted resume was not found." }, { status: 404 });
  try {
    const body = await request.json();
    const result = await saveResumeTargetProjects(owner.database, owner.user.id, targetId, body.projects);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the project lines and try again." }, { status: 422 });
    const mapped = error instanceof TargetResumeError ? error : new TargetResumeError("RESUME_TARGET_INVALID", "The résumé projects could not be saved.");
    const status = mapped.code === "RESUME_TARGET_NOT_FOUND" ? 404 : 422;
    return NextResponse.json({ error: mapped.message }, { status });
  }
}
