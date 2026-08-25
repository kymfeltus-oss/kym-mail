import { describe, expect, it } from "vitest";
import { parseCareerEdit } from "@/lib/career/editing";

describe("career owner editing", () => {
  it("promotes owner edits to resolved authority", () => {
    expect(parseCareerEdit("profile", { professional_headline: "Finance Systems Executive" })).toMatchObject({
      professional_headline: "Finance Systems Executive",
      authority_status: "RESOLVED"
    });
  });

  it("rejects fields outside the entity allowlist", () => {
    expect(() => parseCareerEdit("profile", { owner_id: crypto.randomUUID(), full_name: "Kym Feltus" })).toThrow();
  });

  it("does not permit an empty edit", () => {
    expect(() => parseCareerEdit("profile", {})).toThrow(/at least one fact/i);
  });

  it("preserves unknown dates without inventing a value", () => {
    expect(parseCareerEdit("experience", { start_date: null, start_precision: "UNKNOWN" })).toMatchObject({
      start_date: null,
      start_precision: "UNKNOWN"
    });
  });
});
