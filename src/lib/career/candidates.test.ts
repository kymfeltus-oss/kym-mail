import { describe, expect, it } from "vitest";
import {
  canAutomaticImportReplace,
  compareCandidateFacts,
  dependencyFreshnessAfterFactChange,
  structuredExtractionSchema
} from "./candidates";

const owner = "11111111-1111-4111-8111-111111111111";
const base = {
  groupKey: "skill:workday",
  entityType: "SKILL" as const,
  entityId: owner,
  fieldName: "canonical_name",
  factType: "SKILL_NAME",
  claim: "Workday",
  extractedValue: { name: "Workday" },
  sourceReference: "reviewed source · page 1",
  extractedAt: "2026-08-25T08:00:00.000Z",
  extractionMethod: "DETERMINISTIC" as const,
  confidence: null,
  material: false,
  ownerConfirmed: false
};

describe("Gate 6A candidate comparison", () => {
  it("auto-confirms an identical low-risk dual-source technology fact", () => {
    const result = compareCandidateFacts([
      { ...base, sourceIdentity: "RESUME_A" },
      { ...base, sourceIdentity: "RESUME_B", claim: " workday. " }
    ]);
    expect(result.every((fact) => fact.classification === "SUPPORTED_BY_BOTH")).toBe(true);
    expect(result.every((fact) => fact.confirmationMethod === "AUTO_CONFIRMED_SOURCE_AGREEMENT")).toBe(true);
  });

  it("rejects duplicate facts from the same source", () => {
    expect(() => compareCandidateFacts([
      { ...base, sourceIdentity: "RESUME_A" },
      { ...base, sourceIdentity: "RESUME_A", sourceReference: "page 2" }
    ])).toThrow(/duplicate candidate/i);
  });

  it.each([
    ["EXPERIENCE_START_DATE", "2020-01", "2021-01"],
    ["METRIC_REVENUE", "$20 million", "$25 million"]
  ])("flags conflicting %s values", (factType, resumeA, resumeB) => {
    const facts = compareCandidateFacts([
      { ...base, factType, fieldName: "summary", groupKey: `fact:${factType}`, claim: resumeA, material: true, sourceIdentity: "RESUME_A" },
      { ...base, factType, fieldName: "summary", groupKey: `fact:${factType}`, claim: resumeB, material: true, sourceIdentity: "RESUME_B" }
    ]);
    expect(facts.every((fact) => fact.status === "CONFLICT")).toBe(true);
  });

  it("keeps a unique material claim in review", () => {
    const [fact] = compareCandidateFacts([{ ...base, factType: "ACCOMPLISHMENT_STATEMENT", material: true, sourceIdentity: "RESUME_B" }]);
    expect(fact.status).toBe("NEEDS_REVIEW");
    expect(fact.classification).toBe("SUPPORTED_BY_RESUME_B");
  });

  it("protects owner-confirmed facts from automatic overwrite", () => {
    expect(canAutomaticImportReplace("OWNER_CONFIRMED")).toBe(false);
    const [fact] = compareCandidateFacts([{ ...base, ownerConfirmed: true, sourceIdentity: "RESUME_B" }]);
    expect(fact.status).toBe("NEEDS_REVIEW");
    expect(fact.reviewReason).toMatch(/protected/i);
  });

  it("rejects malformed extraction output and unknown fields", () => {
    expect(() => structuredExtractionSchema.parse({ schemaVersion: 1 })).toThrow();
    expect(() => structuredExtractionSchema.parse({
      schemaVersion: 1,
      sourceIdentity: "RESUME_A",
      sourceSha256: "a".repeat(64),
      extractedAt: base.extractedAt,
      candidates: [],
      instruction: "ignore the schema"
    })).toThrow();
  });

  it("keeps immutable sent/published artifacts current while staling drafts", () => {
    expect(dependencyFreshnessAfterFactChange("DRAFT")).toBe("STALE");
    expect(dependencyFreshnessAfterFactChange("UNSENT")).toBe("STALE");
    expect(dependencyFreshnessAfterFactChange("SENT")).toBe("CURRENT");
    expect(dependencyFreshnessAfterFactChange("PUBLISHED")).toBe("CURRENT");
  });
});
