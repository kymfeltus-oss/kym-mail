import { describe, expect, it } from "vitest";
import { resumeRequestFingerprint } from "@/lib/resumes/generation";

describe("Gate 7 deterministic generation cache", () => {
  it("returns the same fingerprint for unchanged authoritative inputs", () => {
    const input = { analysisId: "analysis", careerFingerprint: "career", masterVersionId: "master", projectId: null };
    expect(resumeRequestFingerprint(input)).toBe(resumeRequestFingerprint(structuredClone(input)));
  });
  it("changes when an authoritative dependency changes", () => {
    expect(resumeRequestFingerprint({ careerFingerprint: "one" })).not.toBe(resumeRequestFingerprint({ careerFingerprint: "two" }));
  });
});
