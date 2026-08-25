import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { generateResumeVersion } from "@/lib/resumes/generation";
import { resumeContentSchema } from "@/lib/resumes/types";
import { ResumeValidationError } from "@/lib/resumes/validation";
import { log } from "@/lib/logger";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("GENERATE") }),
  z.object({ action: z.literal("EDIT"), content: resumeContentSchema }),
  z.object({ action: z.literal("REGENERATE"), scope: z.enum(["ENTIRE", "SUMMARY"]), contentKey: z.string().max(160).optional() }),
  z.object({ action: z.literal("REGENERATE_BULLET"), contentKey: z.string().regex(/^(experience|project):[a-f0-9-]+:bullet:\d+$/) })
]);

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function safeFailure(error: unknown) {
  const code = error instanceof ResumeValidationError ? error.code : error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : "RESUME_GENERATION_FAILED";
  const status = code === "CURRENT_CAREER_MATCH_REQUIRED" ? 409 : code === "SAVED_JOB_NOT_FOUND" ? 404 : code === "RESUME_FACT_VALIDATION_FAILED" ? 422 : 500;
  const messages: Record<string, string> = {
    CURRENT_CAREER_MATCH_REQUIRED: "Run a current Career Match before creating or regenerating this resume.",
    SAVED_JOB_NOT_FOUND: "Saved job not found.",
    RESUME_FACT_VALIDATION_FAILED: error instanceof Error ? error.message : "Resume facts could not be validated."
  };
  return { code, status, message: messages[code] ?? "KYM Mail could not create this resume. The last successful version remains available." };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Resume request is invalid." }, { status: 422 });
  try {
    const options = parsed.data.action === "EDIT"
      ? { kind: "USER_EDIT" as const, proposedContent: parsed.data.content }
      : parsed.data.action === "REGENERATE"
        ? { kind: parsed.data.scope === "SUMMARY" ? "SUMMARY_REGENERATION" as const : "REGENERATED" as const, scope: { type: parsed.data.scope as "ENTIRE" | "SUMMARY", contentKey: parsed.data.contentKey } }
        : parsed.data.action === "REGENERATE_BULLET"
          ? { kind: "BULLET_REGENERATION" as const, scope: { type: "BULLET" as const, contentKey: parsed.data.contentKey } }
          : {};
    const result = await generateResumeVersion(owner.database, owner.user.id, jobId, options);
    log("info", "tailored_resume_version_ready", { jobId, resumeId: result.resumeId, versionId: result.versionId, versionNumber: result.versionNumber });
    return NextResponse.json({ resumeId: result.resumeId, versionId: result.versionId, versionNumber: result.versionNumber, status: "READY" });
  } catch (error) {
    const failure = safeFailure(error);
    log("warn", "tailored_resume_version_failed", { jobId, code: failure.code });
    return NextResponse.json({ error: failure.message, code: failure.code, previousSuccessPreserved: true }, { status: failure.status });
  }
}

