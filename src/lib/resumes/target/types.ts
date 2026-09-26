import { z } from "zod";
import type { ResumeTargetIntelligence } from "@/lib/resumes/target/intelligence";

export const targetRequirementCategorySchema = z.enum([
  "RESPONSIBILITY", "SKILL", "TECHNOLOGY", "SYSTEM", "ACCOUNTING", "FINANCE", "DATA",
  "EDUCATION", "CERTIFICATION", "EXPERIENCE", "LEADERSHIP", "INDUSTRY", "OTHER"
]);
export const targetRequirementImportanceSchema = z.enum(["REQUIRED", "PREFERRED", "RESPONSIBILITY", "CONTEXT"]);
export const targetMatchStateSchema = z.enum(["STRONG_MATCH", "MATCH", "PARTIAL_MATCH", "NO_MATCH", "UNVERIFIED", "NOT_APPLICABLE"]);
export const targetConfirmationAnswerSchema = z.enum(["YES", "NO"]);

export const targetEvidenceSchema = z.object({
  type: z.string().min(2).max(40),
  id: z.string().uuid(),
  label: z.string().trim().min(2).max(300),
  excerpt: z.string().trim().min(2).max(800)
});

export const targetRequirementSchema = z.object({
  id: z.string().uuid(),
  sequenceNumber: z.number().int().positive(),
  originalText: z.string().trim().min(3).max(2000),
  category: targetRequirementCategorySchema,
  importance: targetRequirementImportanceSchema,
  matchState: targetMatchStateSchema,
  explanation: z.string().trim().min(3).max(2000),
  matchedEvidence: z.array(targetEvidenceSchema).max(8),
  needsConfirmation: z.boolean()
});
export type TargetRequirement = z.infer<typeof targetRequirementSchema>;

export const targetConfirmationSchema = z.object({
  requirementId: z.string().uuid(),
  answer: targetConfirmationAnswerSchema,
  promptText: z.string().max(2000)
});
export type TargetConfirmationInput = z.infer<typeof targetConfirmationSchema>;

export const targetResumeContentSchema = z.object({
  candidate: z.object({
    fullName: z.string().trim().min(2).max(120),
    headline: z.string().trim().min(2).max(300),
    location: z.string().trim().max(200).nullable()
  }),
  target: z.object({
    jobTitle: z.string().trim().min(2).max(300),
    employer: z.string().trim().min(2).max(200)
  }),
  thesis: z.string().trim().min(2).max(400),
  summary: z.string().trim().min(2).max(3000),
  highlights: z.array(z.object({
    label: z.string().trim().min(2).max(120),
    text: z.string().trim().min(2).max(800),
    source: z.enum(["MATCHED", "CONFIRMED"])
  })).max(6),
  experiences: z.array(z.object({
    experienceId: z.string().uuid(),
    employer: z.string().trim().min(2).max(200),
    client: z.string().trim().min(2).max(200).nullable(),
    title: z.string().trim().min(2).max(200).nullable(),
    startDate: z.string().nullable(),
    startPrecision: z.enum(["MONTH", "YEAR", "UNKNOWN"]),
    endDate: z.string().nullable(),
    endPrecision: z.enum(["MONTH", "YEAR", "UNKNOWN"]),
    isCurrent: z.boolean(),
    location: z.string().trim().max(200).nullable(),
    bullets: z.array(z.string().trim().min(2).max(800)).max(8)
  })).min(1).max(20),
  projects: z.array(z.object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    bullets: z.array(z.string().trim().min(2).max(800)).min(1).max(6)
  })).max(6),
  skillGroups: z.array(z.object({
    category: z.enum(["FINANCE", "ACCOUNTING", "TECHNOLOGY", "SYSTEM", "DATA", "LEADERSHIP", "INDUSTRY"]),
    skills: z.array(z.object({ skillId: z.string().uuid(), name: z.string().trim().min(1).max(160) })).min(1).max(24)
  })).max(10),
  education: z.array(z.object({
    educationId: z.string().uuid(),
    degree: z.string().trim().min(2).max(200),
    fieldOfStudy: z.string().trim().min(2).max(200).nullable(),
    institution: z.string().trim().min(2).max(200),
    completedOn: z.string().nullable()
  })).max(10),
  credentials: z.array(z.object({
    credentialId: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    status: z.enum(["ACTIVE", "INACTIVE", "COMPLETED", "CANDIDATE"])
  })).max(10),
  confirmedCapabilities: z.array(z.object({
    requirementId: z.string().uuid(),
    requirement: z.string().trim().min(3).max(2000),
    statement: z.string().trim().min(20).max(2000)
  })).max(80)
});
export type TargetResumeContent = z.infer<typeof targetResumeContentSchema>;

export type TargetResumeView = {
  id: string;
  title: string;
  employer: string;
  jobDescription: string;
  status: "CONFIRMING" | "READY" | "FAILED";
  failureMessage: string | null;
  createdAt: string;
  requirements: TargetRequirement[];
  confirmations: Array<{ requirementId: string; answer: "YES" | "NO"; promptText: string }>;
  currentVersion: { id: string; versionNumber: number; content: TargetResumeContent; createdAt: string } | null;
  intelligenceStatus: "NOT_RUN" | "COMPLETE" | "FAILED";
  intelligenceFailure: string | null;
  intelligence: ResumeTargetIntelligence | null;
};

export type TargetResumeListItem = {
  id: string;
  title: string;
  employer: string;
  status: TargetResumeView["status"];
  createdAt: string;
};
