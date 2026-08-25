import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError } from "@/lib/errors";
import { sanitizeStoredJobDescription } from "@/lib/jobs/analysis";
import { setJobOpportunityProjects } from "@/lib/jobs/persistence";

const mutationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("status"), status: z.enum(["SAVED", "ARCHIVED"]) }),
  z.object({ kind: z.literal("projects"), projectIds: z.array(z.string().uuid()).max(50) }),
  z.object({ kind: z.literal("description"), description: z.string().max(30000) })
]);

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    const { jobId } = await params;
    if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
    const mutation = mutationSchema.parse(await request.json());
    if (mutation.kind === "projects") {
      await setJobOpportunityProjects(owner.database, owner.user.id, jobId, mutation.projectIds);
      return NextResponse.json({ updated: true });
    }
    if (mutation.kind === "description") {
      const description = sanitizeStoredJobDescription(mutation.description);
      const { data, error } = await owner.database.from("job_opportunities").update({ description_text: description }).eq("id", jobId).eq("owner_id", owner.user.id).eq("status", "SAVED").select("id").maybeSingle();
      if (error) throw new Error("JOB_UPDATE_FAILED");
      if (!data) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
      return NextResponse.json({ updated: true });
    }
    const { data, error } = await owner.database.from("job_opportunities").update({ status: mutation.status, saved_at: mutation.status === "SAVED" ? new Date().toISOString() : undefined }).eq("id", jobId).eq("owner_id", owner.user.id).select("id").maybeSingle();
    if (error) throw new Error("JOB_UPDATE_FAILED");
    if (!data) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the saved job change." }, { status: 400 });
    const safe = toSafeError(error);
    const status = safe.code === "VALIDATION" ? 400 : safe.code === "NOT_FOUND" ? 404 : safe.code === "PROVIDER_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json({ error: safe.safeMessage }, { status });
  }
}
