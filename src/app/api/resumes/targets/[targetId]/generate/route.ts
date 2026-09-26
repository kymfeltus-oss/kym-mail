import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { TargetResumeError } from "@/lib/resumes/target/generate";
import { generateResumeTargetVersion } from "@/lib/resumes/target/store";

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
    const result = await generateResumeTargetVersion(owner.database, owner.user.id, targetId);
    return NextResponse.json(result);
  } catch (error) {
    const mapped = error instanceof TargetResumeError ? error : new TargetResumeError("RESUME_TARGET_GENERATE_FAILED", "The targeted resume could not be written.");
    const status = mapped.code === "RESUME_TARGET_NOT_FOUND" ? 404 : mapped.code === "CONFIRMATIONS_REQUIRED" || mapped.code === "CAREER_PROFILE_INCOMPLETE" ? 409 : mapped.code === "RESUME_FACT_VALIDATION_FAILED" || mapped.code === "RESUME_TARGET_INVALID" ? 422 : 500;
    return NextResponse.json({ error: mapped.message }, { status });
  }
}
