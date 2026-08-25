import type { JobAnalysisProvider } from "@/domain/providers/job-analysis-provider";
import {
  JobAnalysisInputError,
  analyzeJobDescription,
  extractJobRequirements,
  groundRequirements,
  validateExtractedRequirements,
  type CareerEvidence,
  type JobAnalysisInput,
  type JobAnalysisResult
} from "@/lib/jobs/analysis";

const ANALYSIS_TIMEOUT_MS = 25_000;

async function withTimeout<T>(work: Promise<T>, milliseconds: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new JobAnalysisInputError("ANALYSIS_TIMEOUT", "The analysis provider timed out before a valid result was returned.")), milliseconds);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function analyzeJobWithProvider(
  job: JobAnalysisInput,
  careerEvidence: CareerEvidence[],
  provider: JobAnalysisProvider
): Promise<JobAnalysisResult> {
  const proposed = await withTimeout(provider.extractRequirements(job), ANALYSIS_TIMEOUT_MS);
  const validated = validateExtractedRequirements(proposed);
  const grounded = groundRequirements(job.description, validated);
  const extracted = grounded.length >= 2 ? grounded : extractJobRequirements(job.description);
  const rankingHints = await withTimeout(
    Promise.all(extracted.map((requirement) => provider.rankEvidence(requirement, careerEvidence))),
    ANALYSIS_TIMEOUT_MS
  );
  return analyzeJobDescription(job, careerEvidence, rankingHints, extracted);
}
