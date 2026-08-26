import { z } from "zod";

export const careerEntityTypeSchema = z.enum(["PROFILE", "ORGANIZATION", "TITLE", "EXPERIENCE", "EDUCATION", "CREDENTIAL", "SKILL", "PROJECT", "ACCOMPLISHMENT", "METRIC"]);
export type CareerEntityType = z.infer<typeof careerEntityTypeSchema>;

export const evidenceRefSchema = z.object({ type: careerEntityTypeSchema, id: z.string().uuid() });
export type EvidenceRef = z.infer<typeof evidenceRefSchema>;

export const resumeTextBlockSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,159}$/),
  text: z.string().trim().min(2).max(3000),
  evidence: z.array(evidenceRefSchema).min(1).max(20)
}).strict();

export const resumeContentSchema = z.object({
  candidate: z.object({
    fullName: z.string().trim().min(2).max(120),
    headline: z.string().trim().min(2).max(300),
    location: z.string().trim().max(200).nullable()
  }),
  target: z.object({ jobTitle: z.string().trim().min(2).max(300), employer: z.string().trim().min(2).max(200) }),
  positioning: resumeTextBlockSchema.optional(),
  whyFit: z.array(resumeTextBlockSchema).max(4).optional(),
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
}).strict();
export type ResumeContent = z.infer<typeof resumeContentSchema>;

export const masterResumeContentSchema = resumeContentSchema.omit({ target: true, positioning: true, whyFit: true });
export type MasterResumeContent = z.infer<typeof masterResumeContentSchema>;

export const resumeStrategySchema = z.object({
  leadWith: z.array(z.string().trim().min(2).max(500)).max(6),
  increaseEmphasis: z.array(z.string().trim().min(2).max(500)).max(8),
  reduceEmphasis: z.array(z.string().trim().min(2).max(500)).max(8),
  addVerifiedEvidence: z.array(z.string().trim().min(2).max(500)).max(8),
  potentialGaps: z.array(z.string().trim().min(2).max(500)).max(8)
});
export type ResumeStrategy = z.infer<typeof resumeStrategySchema>;

export const resumeDiffItemSchema = z.object({
  key: z.string().regex(/^[a-z0-9][a-z0-9._:-]{2,159}$/),
  kind: z.enum(["ADDED", "REMOVED", "REORDERED", "REWRITTEN", "EMPHASIZED", "DEEMPHASIZED"]),
  section: z.enum(["SUMMARY", "EXPERIENCE", "ACCOMPLISHMENTS", "METRICS", "SKILLS", "PROJECTS"]),
  label: z.string().trim().min(2).max(300),
  before: z.string().trim().max(3000).nullable(),
  after: z.string().trim().max(3000).nullable(),
  contentKey: z.string().max(160).nullable()
});
export type ResumeDiffItem = z.infer<typeof resumeDiffItemSchema>;

export const resumeDecisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "EDITED"]),
  editedText: z.string().trim().min(2).max(3000).optional(),
  decidedAt: z.string().datetime()
});
export type ResumeDecision = z.infer<typeof resumeDecisionSchema>;

export const resumePlanSchema = z.object({
  planVersion: z.enum(["gate7.v1", "gate8.v1"]),
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

export type ResumeVersionStatus = "DRAFT" | "GENERATING" | "READY" | "REVIEW" | "APPROVED" | "FAILED" | "STALE" | "ARCHIVED";
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
    projectId: string | null;
    masterResumeVersionId: string | null;
    content: ResumeContent | null;
    plan: ResumePlan | null;
    strategy: ResumeStrategy | null;
    diff: ResumeDiffItem[];
    reviewDecisions: Record<string, ResumeDecision>;
    validationSummary: Record<string, unknown>;
    failureCode: string | null;
    failureMessage: string | null;
    generatedAt: string | null;
    approvedAt: string | null;
    staleAt: string | null;
    createdAt: string;
  }>;
};

export type MasterResumeView = {
  id: string;
  currentVersionId: string | null;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: "DRAFT" | "REVIEW" | "APPROVED" | "STALE" | "ARCHIVED";
    content: MasterResumeContent;
    careerFingerprint: string;
    approvedAt: string | null;
    staleAt: string | null;
    createdAt: string;
  }>;
};
