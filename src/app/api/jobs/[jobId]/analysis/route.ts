import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { JobAnalysisInputError } from "@/lib/jobs/analysis";
import { getJobAnalysisProvider } from "@/lib/jobs/analysis-provider";
import { loadJobAnalysisView, persistCompletedAnalysis, recoverStuckAnalysis } from "@/lib/jobs/analysis-store";
import { loadCareerEvidence } from "@/lib/jobs/career-evidence";
import { fingerprint, JOB_ANALYZER_VERSION } from "@/lib/jobs/analysis";
import { analyzeJobWithProvider } from "@/lib/jobs/run-analysis";
import { log } from "@/lib/logger";

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return !origin || origin === request.nextUrl.origin;
}

function failure(error: unknown) {
  if (error instanceof JobAnalysisInputError) {
    const status = error.code === "ANALYSIS_TIMEOUT" ? 504 : 422;
    return { code: error.code, message: error.message, status };
  }
  return { code: "ANALYSIS_FAILED", message: "KYM Mail could not complete this analysis. The last successful analysis was left unchanged.", status: 500 };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  const { data: job, error: jobError } = await owner.database.from("job_opportunities").select("id, status").eq("id", jobId).eq("owner_id", owner.user.id).maybeSingle();
  if (jobError) return NextResponse.json({ error: "The saved job could not be loaded." }, { status: 503 });
  if (!job || job.status !== "SAVED") return NextResponse.json({ error: "Saved job not found." }, { status: 404 });
  const analysis = await loadJobAnalysisView(owner.database, owner.user.id, job.id);
  return NextResponse.json({ analysis });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { jobId } = await params;
  if (!z.string().uuid().safeParse(jobId).success) return NextResponse.json({ error: "Saved job not found." }, { status: 404 });

  const { data: job, error: jobError } = await owner.database
    .from("job_opportunities")
    .select("id, title, company_name, location_text, description_text, status")
    .eq("id", jobId)
    .eq("owner_id", owner.user.id)
    .maybeSingle();
  if (jobError) return NextResponse.json({ error: "The saved job could not be loaded." }, { status: 503 });
  if (!job || job.status !== "SAVED") return NextResponse.json({ error: "Saved job not found." }, { status: 404 });

  const { data: priorAnalyses, error: versionError } = await owner.database
    .from("job_analyses")
    .select("id, analysis_version, status, started_at")
    .eq("owner_id", owner.user.id)
    .eq("job_opportunity_id", job.id)
    .order("analysis_version", { ascending: false })
    .limit(20);
  if (versionError) return NextResponse.json({ error: "Job analysis is temporarily unavailable." }, { status: 503 });

  const running = (priorAnalyses ?? []).find((analysis) => analysis.status === "ANALYZING");
  if (running) {
    const recovered = await recoverStuckAnalysis(owner.database, owner.user.id, { id: running.id, status: "ANALYZING", startedAt: running.started_at });
    if (recovered.status === "ANALYZING") {
      return NextResponse.json({ error: "An analysis is already in progress for this job.", code: "ANALYSIS_IN_PROGRESS" }, { status: 409 });
    }
  }

  const analysisVersion = Math.max(0, ...(priorAnalyses ?? []).map((analysis) => Number(analysis.analysis_version))) + 1;
  const pendingCareerFingerprint = fingerprint("pending-career-profile");
  const { data: analysis, error: analysisError } = await owner.database.from("job_analyses").insert({
    owner_id: owner.user.id,
    job_opportunity_id: job.id,
    analysis_version: analysisVersion,
    analyzer_version: JOB_ANALYZER_VERSION,
    status: "ANALYZING",
    description_fingerprint: fingerprint(job.description_text ?? ""),
    career_fingerprint: pendingCareerFingerprint,
    job_snapshot: { title: job.title, employer: job.company_name, location: job.location_text, seniority: "PENDING" }
  }).select("id").single();
  if (analysisError || !analysis) {
    return NextResponse.json({ error: "KYM Mail could not start this analysis." }, { status: analysisError?.code === "23505" ? 409 : 503 });
  }

  try {
    const careerEvidence = await loadCareerEvidence(owner.database, owner.user.id);
    const result = await analyzeJobWithProvider(
      { id: job.id, title: job.title, employer: job.company_name, location: job.location_text, description: job.description_text ?? "" },
      careerEvidence,
      getJobAnalysisProvider()
    );
    await persistCompletedAnalysis(owner.database, owner.user.id, job.id, analysis.id, result, careerEvidence);
    log("info", "job_analysis_completed", { jobId: job.id, analysisId: analysis.id, score: result.overallScore, requirementCount: result.requirements.length });
    return NextResponse.json({ analysisId: analysis.id, status: "COMPLETE", score: result.overallScore });
  } catch (error) {
    const safe = failure(error);
    await owner.database.from("job_analyses").update({
      status: "FAILED",
      failure_code: safe.code,
      failure_message: safe.message,
      career_fingerprint: pendingCareerFingerprint
    }).eq("id", analysis.id).eq("owner_id", owner.user.id);
    log("warn", "job_analysis_failed", { jobId: job.id, analysisId: analysis.id, code: safe.code });
    return NextResponse.json({ error: safe.message, code: safe.code, previousSuccessPreserved: true }, { status: safe.status });
  }
}
