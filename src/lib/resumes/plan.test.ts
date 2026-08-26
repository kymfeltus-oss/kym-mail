import { describe, expect, it } from "vitest";
import { scoreResumeEvidence } from "@/lib/resumes/plan";

describe("Gate 7 evidence relevance", () => {
  it("scores responsibility requirements deterministically", () => {
    expect(scoreResumeEvidence(70, "RESPONSIBILITY", "MATCH")).toBe(81);
  });

  it("keeps scores within the persisted contract", () => {
    expect(scoreResumeEvidence(99, "REQUIRED", "STRONG_MATCH")).toBe(100);
    expect(scoreResumeEvidence(1, "CONTEXT", "NO_MATCH")).toBe(1);
  });
});
