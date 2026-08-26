import type { CareerEvidence, ExtractedRequirement, JobAnalysisInput } from "@/lib/jobs/analysis";
import { evidenceRelevance, extractJobRequirements } from "@/lib/jobs/analysis";
import type { JobAnalysisProvider } from "@/domain/providers/job-analysis-provider";

/** Bounded interpreter: extracts JD structure and ranks candidate evidence. It never assigns match state or score. */
export class DeterministicJobAnalysisProvider implements JobAnalysisProvider {
  readonly id = "deterministic-job-analysis-v2";

  async extractRequirements(job: JobAnalysisInput): Promise<ExtractedRequirement[]> {
    return extractJobRequirements(job.description);
  }

  async rankEvidence(requirement: ExtractedRequirement, evidence: CareerEvidence[]) {
    return evidence
      .map((item) => ({
        evidenceId: item.id,
        relevance: evidenceRelevance(requirement, item),
        explanation: `${item.label} is candidate supporting evidence from the Master Career Profile.`
      }))
      .filter((item) => item.relevance >= 30)
      .sort((left, right) => right.relevance - left.relevance)
      .slice(0, 8);
  }
}
