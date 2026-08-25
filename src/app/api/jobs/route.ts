import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError } from "@/lib/errors";
import { saveJobOpportunity } from "@/lib/jobs/persistence";
import { getJobSearchProvider } from "@/lib/jobs/provider";
import { jobSearchInputSchema, parseJobSearchInput } from "@/lib/jobs/search";

const requestSchema = z.object({
  providerJobId: z.string().trim().min(1).max(300),
  projectId: z.string().uuid().nullable().optional().default(null),
  search: jobSearchInputSchema
});

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  try {
    const input = requestSchema.parse(await request.json());
    const search = parseJobSearchInput(input.search);
    const result = await getJobSearchProvider().search(search);
    const job = result.jobs.find((candidate) => candidate.providerJobId === input.providerJobId);
    if (!job) return NextResponse.json({ error: "This provider listing is no longer available in the current results." }, { status: 404 });
    const jobId = await saveJobOpportunity(owner.database, owner.user.id, job, input.projectId);
    return NextResponse.json({ jobId, saved: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the job details." }, { status: 400 });
    const safe = toSafeError(error);
    const status = safe.code === "VALIDATION" ? 400 : safe.code === "NOT_FOUND" ? 404 : safe.code === "CONFIGURATION" || safe.code === "PROVIDER_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json({ error: safe.safeMessage }, { status });
  }
}
