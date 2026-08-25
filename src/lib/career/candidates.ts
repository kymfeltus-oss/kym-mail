import { z } from "zod";

export const sourceIdentitySchema = z.enum(["RESUME_A", "RESUME_B"]);
export const candidateClassificationSchema = z.enum([
  "SUPPORTED_BY_BOTH",
  "SUPPORTED_BY_RESUME_A",
  "SUPPORTED_BY_RESUME_B",
  "POTENTIAL_CONFLICT"
]);
export const careerFactStatusSchema = z.enum(["CONFIRMED", "NEEDS_REVIEW", "CONFLICT", "REJECTED"]);

const candidateEntitySchema = z.enum([
  "PROFILE", "ORGANIZATION", "TITLE", "EXPERIENCE", "EDUCATION",
  "CREDENTIAL", "SKILL", "PROJECT", "ACCOMPLISHMENT", "METRIC"
]);

export const extractedCandidateSchema = z.object({
  sourceIdentity: sourceIdentitySchema,
  groupKey: z.string().trim().min(3).max(500),
  entityType: candidateEntitySchema,
  entityId: z.uuid(),
  fieldName: z.string().regex(/^[a-z][a-z0-9_]{1,79}$/),
  factType: z.string().regex(/^[A-Z][A-Z0-9_]{1,79}$/),
  claim: z.string().trim().min(1).max(5000),
  extractedValue: z.unknown(),
  sourceReference: z.string().trim().min(2).max(500),
  extractedAt: z.iso.datetime({ offset: true }),
  extractionMethod: z.enum(["PERSISTED_REVIEWED_IMPORT", "DETERMINISTIC", "AI_STRUCTURED"]),
  confidence: z.number().min(0).max(1).nullable().default(null),
  material: z.boolean().default(false),
  ownerConfirmed: z.boolean().default(false)
}).strict();

export const structuredExtractionSchema = z.object({
  schemaVersion: z.literal(1),
  sourceIdentity: sourceIdentitySchema,
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  extractedAt: z.iso.datetime({ offset: true }),
  candidates: z.array(extractedCandidateSchema).max(2000)
}).strict();

export type ExtractedCandidate = z.infer<typeof extractedCandidateSchema>;
export type CandidateClassification = z.infer<typeof candidateClassificationSchema>;

const punctuation = /[^a-z0-9+#.]+/g;
const technologyAliases: Record<string, string> = {
  "ms excel": "microsoft excel",
  "powerbi": "power bi",
  "quick books": "quickbooks",
  "net suite": "netsuite",
  "work day": "workday"
};

export function normalizeCandidateClaim(claim: string, factType: string) {
  const normalized = claim.normalize("NFKC").toLowerCase().replace(punctuation, " ").trim().replace(/^\.+|\.+$/g, "").trim().replace(/\s+/g, " ");
  if (/^(SKILL|TECHNOLOGY|SYSTEM|ERP)(_|$)/.test(factType)) return technologyAliases[normalized] ?? normalized;
  if (/(DATE|START|END)/.test(factType)) {
    const date = /^([0-9]{4})[-/]([0-9]{1,2})(?:[-/]([0-9]{1,2}))?$/.exec(normalized);
    if (date) return `${date[1]}-${date[2].padStart(2, "0")}${date[3] ? `-${date[3].padStart(2, "0")}` : ""}`;
  }
  return normalized;
}

export function isSafeForAutoConfirmation(factType: string, material: boolean) {
  if (material) return false;
  if (/(DATE|START|END|TITLE|METRIC|NUMBER|AMOUNT|REVENUE|CREDENTIAL|EDUCATION|DEGREE|ACCOMPLISHMENT|RESPONSIBILITY)/.test(factType)) return false;
  return /^(SKILL|TECHNOLOGY|SYSTEM|ERP)(_|$)/.test(factType);
}

export type ComparedCandidate = ExtractedCandidate & {
  normalizedClaim: string;
  classification: CandidateClassification;
  status: z.infer<typeof careerFactStatusSchema>;
  confirmationMethod: "AUTO_CONFIRMED_SOURCE_AGREEMENT" | null;
  reviewReason: string | null;
};

export function compareCandidateFacts(rawCandidates: unknown[]): ComparedCandidate[] {
  const candidates = z.array(extractedCandidateSchema).parse(rawCandidates);
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.sourceIdentity}:${candidate.groupKey}:${normalizeCandidateClaim(candidate.claim, candidate.factType)}`;
    if (seen.has(key)) throw new Error(`Duplicate candidate fact: ${candidate.groupKey}`);
    seen.add(key);
  }

  const groups = Map.groupBy(candidates, (candidate) => candidate.groupKey);
  return candidates.map((candidate) => {
    const normalizedClaim = normalizeCandidateClaim(candidate.claim, candidate.factType);
    const peers = (groups.get(candidate.groupKey) ?? []).filter((peer) => peer.sourceIdentity !== candidate.sourceIdentity);
    const exactPeer = peers.find((peer) => normalizeCandidateClaim(peer.claim, peer.factType) === normalizedClaim);
    const safeAgreement = Boolean(exactPeer) && isSafeForAutoConfirmation(candidate.factType, candidate.material);

    if (candidate.ownerConfirmed) {
      return { ...candidate, normalizedClaim, classification: peers.length ? "POTENTIAL_CONFLICT" : candidate.sourceIdentity === "RESUME_A" ? "SUPPORTED_BY_RESUME_A" : "SUPPORTED_BY_RESUME_B", status: "NEEDS_REVIEW", confirmationMethod: null, reviewReason: "An owner-confirmed value is protected; the new source may only suggest a review." };
    }
    if (safeAgreement) {
      return { ...candidate, normalizedClaim, classification: "SUPPORTED_BY_BOTH", status: "CONFIRMED", confirmationMethod: "AUTO_CONFIRMED_SOURCE_AGREEMENT", reviewReason: null };
    }
    if (exactPeer) {
      return { ...candidate, normalizedClaim, classification: "SUPPORTED_BY_BOTH", status: "NEEDS_REVIEW", confirmationMethod: null, reviewReason: "Both sources agree, but this material fact requires owner confirmation." };
    }
    if (peers.length) {
      return { ...candidate, normalizedClaim, classification: "POTENTIAL_CONFLICT", status: "CONFLICT", confirmationMethod: null, reviewReason: "Resume A and Resume B contain different values for this fact." };
    }
    return { ...candidate, normalizedClaim, classification: candidate.sourceIdentity === "RESUME_A" ? "SUPPORTED_BY_RESUME_A" : "SUPPORTED_BY_RESUME_B", status: candidate.material ? "NEEDS_REVIEW" : "NEEDS_REVIEW", confirmationMethod: null, reviewReason: candidate.material ? "Unique material source claim requires owner review." : "Unique source claim requires owner review before becoming authoritative." };
  });
}

export function canAutomaticImportReplace(existingConfirmation: string | null) {
  return existingConfirmation !== "OWNER_CONFIRMED";
}

export function dependencyFreshnessAfterFactChange(lifecycleState: "DRAFT" | "UNSENT" | "SENT" | "PUBLISHED") {
  return lifecycleState === "DRAFT" || lifecycleState === "UNSENT" ? "STALE" as const : "CURRENT" as const;
}
