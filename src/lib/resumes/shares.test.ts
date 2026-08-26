import { describe, expect, it } from "vitest";
import { createResumeShareToken, hashResumeShareToken, isResumeShareToken } from "@/lib/resumes/shares";

describe("Gate 7 secure resume tokens", () => {
  it("creates unguessable tokens while persisting only a one-way hash", () => {
    const token = createResumeShareToken();
    const hash = hashResumeShareToken(token);
    expect(isResumeShareToken(token)).toBe(true);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });
  it("rejects malformed public tokens", () => expect(isResumeShareToken("guessable-token")).toBe(false));
});
