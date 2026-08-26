import { z } from "zod";

export const contactClassifications = [
  "FUNCTIONAL_LEADER", "EXECUTIVE_SPONSOR",
  "ACCOUNTING_LEADER", "FINANCE_LEADER", "SYSTEMS_LEADER",
  "RECRUITER", "TALENT_ACQUISITION", "OTHER_RELEVANT"
] as const;
export const contactEmailStatuses = ["VERIFIED", "DELIVERABLE", "LIKELY", "UNVERIFIED", "RISKY", "INVALID", "NOT_FOUND"] as const;
export const contactSearchStatuses = ["NOT_SEARCHED", "SEARCHING", "COMPLETE", "PARTIAL", "FAILED", "STALE"] as const;
export const contactSourceTypes = ["PEOPLE_PROVIDER", "EMAIL_PROVIDER", "VERIFICATION_PROVIDER", "JOB_POSTING", "USER_ENTERED"] as const;
export const postingTypes = ["DIRECT_EMPLOYER", "AGENCY_RECRUITER", "UNKNOWN"] as const;
export const personVerificationStates = ["VERIFIED", "LIKELY_CURRENT", "STALE_OR_UNCERTAIN", "UNVERIFIED"] as const;
export const contactRelevanceLevels = ["HIGH", "MEDIUM", "LOW"] as const;
export const contactApprovalStates = ["DISCOVERED", "RECOMMENDED", "APPROVED", "REJECTED", "STALE"] as const;

export type ContactClassification = (typeof contactClassifications)[number];
export type ContactEmailStatus = (typeof contactEmailStatuses)[number];
export type ContactSearchStatus = (typeof contactSearchStatuses)[number];
export type ContactSourceType = (typeof contactSourceTypes)[number];
export type PostingType = (typeof postingTypes)[number];
export type PersonVerificationState = (typeof personVerificationStates)[number];
export type ContactRelevanceLevel = (typeof contactRelevanceLevels)[number];
export type ContactApprovalState = (typeof contactApprovalStates)[number];

export const discoveredPersonSchema = z.object({
  providerKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  sourceRecordId: z.string().trim().min(1).max(200),
  fullName: z.string().trim().min(2).max(160),
  firstName: z.string().trim().min(1).max(80).nullable(),
  lastName: z.string().trim().min(1).max(80).nullable(),
  currentTitle: z.string().trim().min(2).max(200),
  department: z.string().trim().min(2).max(120).nullable(),
  seniority: z.string().trim().min(2).max(80).nullable(),
  companyName: z.string().trim().min(2).max(200),
  companyDomain: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/).nullable(),
  location: z.string().trim().min(2).max(200).nullable(),
  professionalProfileUrl: z.string().url().startsWith("https://").nullable(),
  observedAt: z.string().datetime(),
  providerConfidence: z.number().int().min(0).max(100).nullable()
});

export const discoveredEmailSchema = z.object({
  providerKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  sourceRecordId: z.string().trim().min(1).max(200).nullable(),
  email: z.string().trim().toLowerCase().email(),
  type: z.enum(["BUSINESS", "PERSONAL", "UNKNOWN"]),
  status: z.enum(contactEmailStatuses),
  providerStatus: z.string().trim().min(1).max(120).nullable(),
  discoveredAt: z.string().datetime(),
  isPatternBased: z.boolean(),
  patternEvidenceCount: z.number().int().min(0).max(100)
});

export const verificationResultSchema = z.object({
  providerKey: z.string().regex(/^[a-z0-9][a-z0-9._-]{1,79}$/),
  email: z.string().trim().toLowerCase().email(),
  status: z.enum(contactEmailStatuses),
  providerStatus: z.string().trim().min(1).max(120).nullable(),
  verifiedAt: z.string().datetime(),
  refreshAfter: z.string().datetime()
});

export type DiscoveredPerson = z.infer<typeof discoveredPersonSchema>;
export type DiscoveredEmail = z.infer<typeof discoveredEmailSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;

export type TargetRole = {
  title: string;
  classification: ContactClassification;
  priority: number;
  reason: string;
};

export type RankedContact = DiscoveredPerson & {
  classifications: ContactClassification[];
  relevanceScore: number;
  relevanceReasons: string[];
  dedupeKey: string;
  emails: Array<DiscoveredEmail & { verification: VerificationResult | null }>;
  provenance: DiscoveredPerson[];
  verificationState: PersonVerificationState;
  relevanceLevel: ContactRelevanceLevel;
  recommendationLabel: string;
};

export type ContactIntelligenceView = {
  providerConfiguration: { people: string | null; requirement: string | null };
  organization: null | {
    id: string;
    canonicalName: string;
    domain: string | null;
    sourceProvider: string;
    confidence: number;
    resolvedAt: string;
    staleAt: string | null;
  };
  search: null | {
    status: ContactSearchStatus;
    targetRoles: TargetRole[];
    searchVersion: number;
    failureCode: string | null;
    failureMessage: string | null;
    completedAt: string | null;
    refreshAfter: string | null;
    postingType: PostingType;
    postingTypeReasons: string[];
    postingTypeEvidence: Array<{ label: string; value: string }>;
    projectId: string | null;
    providerUsage: { requests: number; credits: number | null };
  };
  resumeContext: null | { versionId: string; versionNumber: number; status: "APPROVED" | "STALE"; projectId: string | null };
  contacts: Array<{
    id: string;
    fullName: string;
    currentTitle: string;
    department: string | null;
    seniority: string | null;
    companyName: string;
    companyDomain: string | null;
    location: string | null;
    professionalProfileUrl: string | null;
    classifications: ContactClassification[];
    relevanceScore: number;
    relevanceReasons: string[];
    approvalState: ContactApprovalState;
    verificationState: PersonVerificationState;
    relevanceLevel: ContactRelevanceLevel;
    recommendationLabel: string;
    approvedAt: string | null;
    rejectedAt: string | null;
    projectId: string | null;
    researchVersion: number;
    status: "ACTIVE" | "STALE" | "ARCHIVED";
    sourceProvider: string;
    discoveredAt: string;
    lastConfirmedAt: string;
    sources: Array<{
      id: string;
      sourceType: ContactSourceType;
      providerKey: string;
      fieldName: string;
      claimSummary: string;
      confidence: number;
      observedAt: string;
      sourceUrl: string | null;
    }>;
  }>;
};
