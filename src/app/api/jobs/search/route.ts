import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { toSafeError } from "@/lib/errors";
import { parseJobSearchInput } from "@/lib/jobs/search";
import { getJobSearchProvider } from "@/lib/jobs/provider";

export async function GET(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  try {
    const parameters = request.nextUrl.searchParams;
    const search = parseJobSearchInput({
      query: parameters.get("query") ?? "",
      location: parameters.get("location") ?? "",
      workArrangement: parameters.get("workArrangement") ?? "ANY",
      datePostedDays: parameters.get("datePostedDays") ?? "",
      employmentType: parameters.get("employmentType") ?? "ANY",
      minimumSalary: parameters.get("minimumSalary") ?? "",
      page: parameters.get("page") ?? "1"
    });
    const result = await getJobSearchProvider().search(search);
    const providerIds = result.jobs.map((job) => job.providerJobId);
    const { data: saved, error } = providerIds.length
      ? await owner.database.from("job_opportunities").select("id, provider_job_id, status").eq("owner_id", owner.user.id).eq("provider", "ADZUNA").in("provider_job_id", providerIds)
      : { data: [], error: null };
    if (error) throw new Error("SAVED_STATE_UNAVAILABLE");
    const savedByProviderId = new Map((saved ?? []).map((job) => [job.provider_job_id, job]));
    return NextResponse.json({
      request: search,
      result: { ...result, jobs: result.jobs.map((job) => ({ ...job, savedJobId: savedByProviderId.get(job.providerJobId)?.id ?? null, isSaved: savedByProviderId.get(job.providerJobId)?.status === "SAVED" })) }
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Check the search details." }, { status: 400 });
    const safe = toSafeError(error);
    const status = safe.code === "VALIDATION" ? 400 : safe.code === "CONFIGURATION" ? 503 : safe.code === "PROVIDER_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json({ error: safe.safeMessage }, { status });
  }
}
