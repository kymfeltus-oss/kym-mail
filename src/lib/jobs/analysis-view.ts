import type {
  RequirementCategory,
  RequirementGapReason,
  RequirementImportance,
  RequirementMatchState,
  ScoreBreakdown,
  JobAnalysisStatus
} from "@/lib/jobs/analysis";

export type EvidenceView = {
  id: string;
  type: string;
  label: string;
  excerpt: string;
  explanation: string;
  relevanceScore: number;
};

export type RequirementView = {
  id: string;
  sequenceNumber: number;
  importance: RequirementImportance;
  category: RequirementCategory;
  originalText: string;
  normalizedConcept: string | null;
  matchState: RequirementMatchState;
  explanation: string;
  gapReason: RequirementGapReason | null;
  isMaterial: boolean;
  evidence: EvidenceView[];
};

export type JobAnalysisSummaryView = {
  requirementCount?: number;
  requiredCount?: number;
  preferredCount?: number;
  responsibilityCount?: number;
  strongMatchCount?: number;
  matchCount?: number;
  partialMatchCount?: number;
  gapCount?: number;
  unverifiedCount?: number;
  notApplicableCount?: number;
  materialGapCount?: number;
  strongestAreas?: string[];
  gaps?: string[];
  materialGaps?: string[];
  scoreExplanation?: string;
  scoreBreakdown?: ScoreBreakdown;
  whyYouMatch?: string[];
  whereYouDont?: string[];
  resumeUnderselling?: string[];
  recommendedResumeStrategy?: string[];
};

export type JobAnalysisView = {
  id: string;
  version: number;
  status: JobAnalysisStatus;
  overallScore: number | null;
  failureCode: string | null;
  failureMessage: string | null;
  completedAt: string | null;
  staleAt: string | null;
  descriptionFingerprint?: string;
  careerFingerprint?: string;
  startedAt?: string | null;
  previousSuccessPreserved: boolean;
  lastSuccessfulCompletedAt: string | null;
  summary: JobAnalysisSummaryView;
  requirements: RequirementView[];
};
