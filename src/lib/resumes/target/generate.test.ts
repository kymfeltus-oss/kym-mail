import { describe, expect, it } from "vitest";
import type { CareerFacts } from "@/lib/resumes/career";
import { analyzeResumeTarget } from "@/lib/resumes/target/analyze";
import { generateTargetResume } from "@/lib/resumes/target/generate";
import { validateTargetResume } from "@/lib/resumes/target/validate";
import type { TargetRequirement } from "@/lib/resumes/target/types";

const ownerId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const orgId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const titleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const expId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const skillId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const accId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const eduId = "99999999-9999-4999-8999-999999999999";
const credId = "88888888-8888-4888-8888-888888888888";

function career(): CareerFacts {
  const facts = [
    { type: "PROFILE" as const, id: ownerId, label: "Kym Feltus", text: "Finance systems executive. Transforms close, consolidation, and reporting." },
    { type: "ORGANIZATION" as const, id: orgId, label: "Mass Development Group", text: "Mass Development Group" },
    { type: "TITLE" as const, id: titleId, label: "Principal", text: "Principal" },
    { type: "EXPERIENCE" as const, id: expId, label: "Led finance transformation", text: "Led finance transformation 2020-01-01" },
    { type: "EDUCATION" as const, id: eduId, label: "Bachelor in Accounting", text: "Bachelor Accounting Emory University" },
    { type: "CREDENTIAL" as const, id: credId, label: "CPA", text: "CPA ACTIVE" },
    { type: "SKILL" as const, id: skillId, label: "NetSuite", text: "NetSuite" },
    { type: "ACCOMPLISHMENT" as const, id: accId, label: "Automated the monthly close", text: "Automated the monthly close and shortened reporting cycles." }
  ];
  return {
    profile: { ownerId, fullName: "Kym Feltus", headline: "Finance systems executive", location: "Atlanta, GA", summary: "Transforms close, consolidation, and reporting.", years: "15" },
    organizations: [{ id: orgId, name: "Mass Development Group" }],
    titles: [{ id: titleId, name: "Principal" }],
    experiences: [{ id: expId, organizationId: orgId, clientOrganizationId: null, titleId, startDate: "2020-01-01", startPrecision: "MONTH", endDate: null, endPrecision: "UNKNOWN", isCurrent: true, location: "Atlanta, GA", summary: "Led finance transformation", completeness: "COMPLETE" }],
    education: [{ id: eduId, degree: "Bachelor", fieldOfStudy: "Accounting", institution: "Emory University", completedOn: "2008-05-01" }],
    credentials: [{ id: credId, name: "CPA", status: "ACTIVE" }],
    skills: [{ id: skillId, name: "NetSuite", category: "SYSTEM" }],
    projects: [],
    accomplishments: [{ id: accId, experienceId: expId, projectId: null, statement: "Automated the monthly close and shortened reporting cycles." }],
    metrics: [],
    aliases: [],
    factsByKey: new Map(facts.map((fact) => [`${fact.type}:${fact.id}`, fact])),
    fingerprint: "test"
  };
}

const description = `
Director of Accounting and Finance Transformation

Required Qualifications
Lead accounting close, consolidation, and financial reporting.
10+ years of finance and accounting leadership experience.
Bachelor's degree in Accounting is required.
Active CPA license required.
NetSuite ERP experience.
Kubernetes cluster administration experience.
Build and automate scalable finance processes.

Preferred Qualifications
Python experience.
`;

describe("targeted resume matching", () => {
  it("asks the owner to confirm unmatched requirements and keeps matched evidence", () => {
    const result = analyzeResumeTarget({ title: "Director of Accounting", employer: "Example Capital", description }, career());
    expect(result.matched.some((item) => /NetSuite/i.test(item.originalText))).toBe(true);
    expect(result.pendingConfirmations.some((item) => /Kubernetes/i.test(item.originalText))).toBe(true);
  });
});

describe("targeted resume generation", () => {
  it("writes confirmed experience into the resume and omits denied requirements", () => {
    const analysis = analyzeResumeTarget({ title: "Director of Accounting", employer: "Example Capital", description }, career());
    const requirements = analysis.requirements.map((item, index) => ({
      ...item,
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
    })) as TargetRequirement[];
    const confirmations = requirements.filter((item) => item.needsConfirmation).map((item) => (
      /Kubernetes/i.test(item.originalText)
        ? { requirementId: item.id, answer: "NO" as const, promptText: "" }
        : { requirementId: item.id, answer: "YES" as const, promptText: "I built Python close automation that shortened reporting cycles for finance leadership." }
    ));
    const content = validateTargetResume(
      generateTargetResume({ career: career(), title: "Director of Accounting", employer: "Example Capital", requirements, confirmations }),
      career(),
      { title: "Director of Accounting", employer: "Example Capital" },
      requirements,
      confirmations
    );
    expect(content.thesis).toContain("Example Capital");
    expect(content.confirmedCapabilities.some((item) => /Python/i.test(item.statement))).toBe(true);
    expect(`${content.thesis} ${content.summary} ${content.highlights.map((item) => item.text).join(" ")}`.toLowerCase()).not.toMatch(/kubernetes/);
    expect(content.experiences[0]?.employer).toBe("Mass Development Group");
  });

  it("writes a targeted resume when more than 20 requirements are confirmed", () => {
    const analysis = analyzeResumeTarget({ title: "Director of Accounting", employer: "Example Capital", description }, career());
    const extras: TargetRequirement[] = Array.from({ length: 23 }, (_, index) => ({
      id: `21111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      sequenceNumber: 100 + index,
      originalText: `Unverified capability ${index + 1} for finance operations.`,
      category: "FINANCE",
      importance: "PREFERRED",
      matchState: "UNVERIFIED",
      explanation: "No Career Profile evidence was found for this requirement.",
      matchedEvidence: [],
      needsConfirmation: true
    }));
    const requirements = [
      ...analysis.requirements.map((item, index) => ({
        ...item,
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
      })),
      ...extras
    ] as TargetRequirement[];
    const confirmations = requirements.filter((item) => item.needsConfirmation).map((item) => ({
      requirementId: item.id,
      answer: "YES" as const,
      promptText: `I have this experience from finance transformation work, including capability ${item.originalText.slice(-12)}.`
    }));
    const content = generateTargetResume({ career: career(), title: "Director of Accounting", employer: "Example Capital", requirements, confirmations });
    expect(content.confirmedCapabilities.length).toBeGreaterThan(20);
  });

  it("does not write a resume until unmatched requirements are confirmed", () => {
    const analysis = analyzeResumeTarget({ title: "Director of Accounting", employer: "Example Capital", description }, career());
    const requirements = analysis.requirements.map((item, index) => ({
      ...item,
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`
    })) as TargetRequirement[];
    expect(() => generateTargetResume({ career: career(), title: "Director of Accounting", employer: "Example Capital", requirements, confirmations: [] })).toThrow(/Confirm whether you have each unmatched requirement/i);
  });
});
