import { z } from "zod";

export const careerEntityTypeSchema = z.enum(["PROFILE", "ORGANIZATION", "TITLE", "EXPERIENCE", "EDUCATION", "CREDENTIAL", "SKILL", "PROJECT", "ACCOMPLISHMENT", "METRIC"]);
export type CareerEntityType = z.infer<typeof careerEntityTypeSchema>;

export const evidenceRefSchema = z.object({ type: careerEntityTypeSchema, id: z.string().uuid() });
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const resumeTextBlockSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,159}$/),
  text: z.string().trim().min(2).max(3000),
  evidence: z.array(evidenceRefSchema).min(1).max(20)
});

export const resumeContentSchema = z.object({
  candidate: z.object({
    fullName: z.string().trim().min(2).max(120),
    headline: z.string().trim().min(2).max(300),
    location: z.string().trim().max(200).nullable()
  }),
  target: z.object({ jobTitle: z.string().trim().min(2).max(300), employer: z.string().trim().min(2).max(200) }),
  summary: resumeTextBlockSchema,
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
    bullets: z.array(resumeTextBlockSchema).max(8)
  })).min(1).max(20),
  projects: z.array(z.object({
    projectId: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    bullets: z.array(resumeTextBlockSchema).min(1).max(6)
  })).max(6),
  skillGroups: z.array(z.object({
    category: z.enum(["FINANCE", "ACCOUNTING", "TECHNOLOGY", "SYSTEM", "DATA", "LEADERSHIP", "INDUSTRY"]),
    skills: z.array(z.object({ skillId: z.string().uuid(), name: z.string().trim().min(1).max(160) })).min(1).max(20)
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
  })).max(10)
});
export type ResumeContent = z.infer<typeof resumeContentSchema>;

export const resumePlanSchema = z.object({
  planVersion: z.literal("gate8.v1"),
  jobId: z.string().uuid(),
  analysisId: z.string().uuid(),
  analysisVersion: z.number().int().positive(),
  targetPages: z.literal(2),
  experiencePlans: z.array(z.object({ experienceId: z.string().uuid(), accomplishmentIds: z.array(z.string().uuid()).max(8) })).min(1),
  projectIds: z.array(z.string().uuid()).max(6),
  skillIds: z.array(z.string().uuid()).max(40),
  allowedJobTerms: z.array(z.string().trim().min(2).max(160)).max(100),
  selectedEvidence: z.array(z.object({
    type: careerEntityTypeSchema,
    id: z.string().uuid(),
    label: z.string().min(2).max(300),
    text: z.string().min(2).max(3000),
    relevance: z.number().int().min(1).max(100)
  })).min(1).max(300)
});
export type ResumePlan = z.infer<typeof resumePlanSchema>;

export type ResumeVersionStatus = "DRAFT" | "GENERATING" | "READY" | "FAILED" | "STALE" | "ARCHIVED";
export type ResumeGenerationKind = "INITIAL" | "USER_EDIT" | "REGENERATED" | "SUMMARY_REGENERATION" | "BULLET_REGENERATION";

export type ResumeView = {
  id: string;
  jobId: string;
  currentVersionId: string | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: ResumeVersionStatus;
    generationKind: ResumeGenerationKind;
    providerKey: string;
    providerMode: "DETERMINISTIC" | "AI";
    content: ResumeContent | null;
    plan: ResumePlan | null;
    validationSummary: Record<string, unknown>;
    failureCode: string | null;
    failureMessage: string | null;
    generatedAt: string | null;
    staleAt: string | null;
    createdAt: string;
  }>;
};

