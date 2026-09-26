import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { TargetResumeError } from "@/lib/resumes/target/generate";
import { createResumeTarget } from "@/lib/resumes/target/store";

const bodySchema = z.object({
  title: z.string().trim().min(2).max(300),
  employer: z.string().trim().min(2).max(200),
  description: z.string().trim().min(120).max(30000)
});

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add a role title, company, and the full job description." }, { status: 400 });
  try {
    const result = await createResumeTarget(owner.database, owner.user.id, parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const mapped = error instanceof TargetResumeError ? error : new TargetResumeError("RESUME_TARGET_FAILED", "The targeted resume could not be created.");
    const status = mapped.code === "CAREER_PROFILE_UNAVAILABLE" ? 409 : mapped.code.includes("INCOMPLETE") || mapped.code.includes("MISSING") ? 400 : 500;
    return NextResponse.json({ error: mapped.message }, { status });
  }
}
