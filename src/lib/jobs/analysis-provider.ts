import { DeterministicJobAnalysisProvider } from "@/integrations/analysis/deterministic-job-analysis-provider";

export function getJobAnalysisProvider() {
  return new DeterministicJobAnalysisProvider();
}
