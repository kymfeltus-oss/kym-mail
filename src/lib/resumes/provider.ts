import type { ResumeGenerationProvider } from "@/domain/providers/resume-generation-provider";
import { DeterministicResumeGenerationProvider } from "@/integrations/resume/deterministic-resume-generation-provider";

export function getResumeGenerationProvider(): ResumeGenerationProvider {
  return new DeterministicResumeGenerationProvider();
}

