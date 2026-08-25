import { describe, expect, it } from "vitest";
import type { ResumeContent } from "@/lib/resumes/types";
import { mergeScopedRegeneration } from "@/integrations/resume/deterministic-resume-generation-provider";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  experience: "00000000-0000-4000-8000-000000000002",
  accomplishment: "00000000-0000-4000-8000-000000000003",
  project: "00000000-0000-4000-8000-000000000004",
  skill: "00000000-0000-4000-8000-000000000005",
  education: "00000000-0000-4000-8000-000000000006",
  credential: "00000000-0000-4000-8000-000000000007"
};

function content(summary: string, bullet: string): ResumeContent {
  return {
    candidate: { fullName: "Kym Feltus, MBA", headline: "Finance Executive", location: "DFW, Texas" },
    target: { jobTitle: "Chief Financial Officer", employer: "Planned Parenthood of Michigan" },
    summary: { key: "summary:professional", text: summary, evidence: [{ type: "PROFILE", id: ids.owner }] },
    experiences: [{ experienceId: ids.experience, employer: "McKesson Corporation", client: null, title: "Corporate Controller", startDate: "2012-01-01", startPrecision: "YEAR", endDate: "2018-01-01", endPrecision: "YEAR", isCurrent: false, location: null, bullets: [{ key: `experience:${ids.experience}:bullet:1`, text: bullet, evidence: [{ type: "ACCOMPLISHMENT", id: ids.accomplishment }] }] }],
    projects: [{ projectId: ids.project, name: "ASC606 Revenue Engine", bullets: [{ key: `project:${ids.project}:bullet:1`, text: "Built ASC 606 controls.", evidence: [{ type: "PROJECT", id: ids.project }] }] }],
    skillGroups: [{ category: "SYSTEM", skills: [{ skillId: ids.skill, name: "SAP" }] }],
    education: [{ educationId: ids.education, degree: "Bachelor of Science (B.S.)", fieldOfStudy: "Accounting", institution: "University of North Texas (UNT)", completedOn: null }],
    credentials: [{ credentialId: ids.credential, name: "CPA Candidate", status: "CANDIDATE" }]
  };
}

describe("scoped deterministic regeneration", () => {
  it("regenerates only the summary and preserves a user-edited bullet", () => {
    const generated = content("New generated summary.", "Authoritative generated bullet.");
    const prior = content("Prior summary.", "User-edited bullet.");
    const result = mergeScopedRegeneration(generated, prior, { type: "SUMMARY" });
    expect(result.summary.text).toBe("New generated summary.");
    expect(result.experiences[0].bullets[0].text).toBe("User-edited bullet.");
  });

  it("regenerates only the requested bullet and preserves the prior summary", () => {
    const generated = content("Generated summary.", "Authoritative regenerated bullet.");
    const prior = content("User-edited summary.", "User-edited bullet.");
    const key = generated.experiences[0].bullets[0].key;
    const result = mergeScopedRegeneration(generated, prior, { type: "BULLET", contentKey: key });
    expect(result.summary.text).toBe("User-edited summary.");
    expect(result.experiences[0].bullets[0].text).toBe("Authoritative regenerated bullet.");
  });
});
