import type { CareerEvidence, ExtractedRequirement, JobAnalysisInput } from "@/lib/jobs/analysis";

/** A bounded interpreter may extract or rank candidates, but it never owns score, state, or persistence. */
export interface JobAnalysisProvider {
  readonly id: string;
  extractRequirements(job: JobAnalysisInput): Promise<ExtractedRequirement[]>;
  rankEvidence(requirement: ExtractedRequirement, evidence: CareerEvidence[]): Promise<Array<{ evidenceId: string; relevance: number; explanation: string }>>;
}
