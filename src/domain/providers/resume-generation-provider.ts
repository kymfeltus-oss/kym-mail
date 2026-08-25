import { resumeContentSchema, type ResumeContent, type ResumePlan } from "@/lib/resumes/types";
import type { CareerFacts } from "@/lib/resumes/career";

export const structuredResumeProposalSchema = resumeContentSchema;

export type ResumeGenerationInput = {
  plan: ResumePlan;
  career: CareerFacts;
  job: { id: string; title: string; employer: string; description: string };
  priorContent?: ResumeContent;
  scope?: { type: "ENTIRE" | "SUMMARY" | "BULLET"; contentKey?: string };
};

export interface ResumeGenerationProvider {
  readonly key: string;
  readonly mode: "DETERMINISTIC" | "AI";
  generate(input: ResumeGenerationInput): Promise<ResumeContent>;
}

