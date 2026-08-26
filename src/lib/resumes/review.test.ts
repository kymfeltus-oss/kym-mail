import { describe, expect, it } from "vitest";
import { buildResumeDiff, buildResumeStrategy } from "@/lib/resumes/review";
import type { MasterResumeContent, ResumeContent } from "@/lib/resumes/types";

const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
const master: MasterResumeContent = {
  candidate: { fullName: "Kym Feltus", headline: "Finance Executive", location: "Texas" },
  summary: { key: "summary:professional", text: "Finance executive leading accurate reporting.", evidence: [{ type: "PROFILE", id: id(1) }] },
  experiences: [{ experienceId: id(2), employer: "Authoritative Employer", client: null, title: "Controller", startDate: "2020-01-01", startPrecision: "YEAR", endDate: null, endPrecision: "UNKNOWN", isCurrent: true, location: null, bullets: [{ key: `experience:${id(2)}:bullet:1`, text: "Improved verified reporting controls.", evidence: [{ type: "ACCOMPLISHMENT", id: id(3) }] }] }],
  projects: [], skillGroups: [{ category: "SYSTEM", skills: [{ skillId: id(4), name: "SAP" }, { skillId: id(5), name: "Oracle" }] }], education: [], credentials: []
};
const tailored: ResumeContent = { ...master, target: { jobTitle: "VP Finance", employer: "Target Company" }, summary: { ...master.summary, text: "Finance executive leading verified reporting controls." }, skillGroups: [{ category: "SYSTEM", skills: [{ skillId: id(4), name: "SAP" }] }] };

describe("Gate 7 strategy and material diff", () => {
  it("builds the five required strategy groups only from persisted inputs", () => {
    const strategy = buildResumeStrategy({ whyYouMatch: ["Verified reporting leadership"], recommendedResumeStrategy: ["Lead with controls"], resumeUnderselling: ["Surface SAP"], whereYouDont: ["Do not claim CPA"] }, master, tailored);
    expect(strategy.leadWith).toEqual(["Verified reporting leadership"]);
    expect(strategy.addVerifiedEvidence).toEqual(["Surface SAP"]);
    expect(strategy.potentialGaps).toEqual(["Do not claim CPA"]);
    expect(strategy.reduceEmphasis).toContain("Oracle");
  });
  it("produces concise summary and skill changes instead of two giant documents", () => {
    const diff = buildResumeDiff(master, tailored);
    expect(diff.some((item) => item.section === "SUMMARY" && item.kind === "REWRITTEN")).toBe(true);
    expect(diff.some((item) => item.section === "SKILLS" && item.contentKey === "skills:selection")).toBe(true);
  });
});
