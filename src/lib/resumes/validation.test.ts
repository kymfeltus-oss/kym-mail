import { describe, expect, it } from "vitest";
import type { CareerFacts } from "@/lib/resumes/career";
import type { ResumeContent } from "@/lib/resumes/types";
import { validateResumeContent } from "@/lib/resumes/validation";

const ids = {
  owner: "00000000-0000-4000-8000-000000000001",
  org: "00000000-0000-4000-8000-000000000002",
  title: "00000000-0000-4000-8000-000000000003",
  experience: "00000000-0000-4000-8000-000000000004",
  education: "00000000-0000-4000-8000-000000000005",
  credential: "00000000-0000-4000-8000-000000000006",
  skill: "00000000-0000-4000-8000-000000000007",
  project: "00000000-0000-4000-8000-000000000008",
  accomplishment: "00000000-0000-4000-8000-000000000009"
};
const job = { title: "Chief Financial Officer", employer: "Planned Parenthood" };

const career: CareerFacts = {
  profile: { ownerId: ids.owner, fullName: "Kym Feltus, MBA", headline: "Finance Executive", location: "DFW, Texas", summary: "Finance leader connecting accounting accuracy with executive decisions.", years: "23+" },
  organizations: [{ id: ids.org, name: "Example Corporation" }],
  titles: [{ id: ids.title, name: "Corporate Controller" }],
  experiences: [{ id: ids.experience, organizationId: ids.org, clientOrganizationId: null, titleId: ids.title, startDate: "2012-01-01", startPrecision: "YEAR", endDate: "2018-01-01", endPrecision: "YEAR", isCurrent: false, location: null, summary: "Led finance controls and reporting.", completeness: "COMPLETE" }],
  education: [{ id: ids.education, degree: "Bachelor of Science (B.S.)", fieldOfStudy: "Accounting", institution: "University of North Texas (UNT)", completedOn: null }],
  credentials: [{ id: ids.credential, name: "CPA Candidate", status: "CANDIDATE" }],
  skills: [{ id: ids.skill, name: "SAP", category: "SYSTEM" }],
  projects: [{ id: ids.project, name: "ASC606 Revenue Engine", experienceId: ids.experience, summary: "Built ASC 606 revenue controls.", challenge: null, architecture: null, impact: null }],
  accomplishments: [{ id: ids.accomplishment, experienceId: ids.experience, projectId: null, statement: "Led finance controls and generated more than $50M in savings." }],
  metrics: [], aliases: [{ type: "PROJECT", entityId: ids.project, alias: "ASC 606 Audit Automation" }], fingerprint: "a".repeat(64),
  factsByKey: new Map([
    [`PROFILE:${ids.owner}`, { type: "PROFILE", id: ids.owner, label: "Kym Feltus, MBA", text: "Finance Executive. Finance leader connecting accounting accuracy with executive decisions." }],
    [`ACCOMPLISHMENT:${ids.accomplishment}`, { type: "ACCOMPLISHMENT", id: ids.accomplishment, label: "Savings", text: "Led finance controls and generated more than $50M in savings." }],
    [`PROJECT:${ids.project}`, { type: "PROJECT", id: ids.project, label: "ASC606 Revenue Engine", text: "Built ASC 606 revenue controls." }]
  ])
};

function validContent(): ResumeContent {
  return {
    candidate: { fullName: career.profile.fullName, headline: career.profile.headline, location: career.profile.location },
    target: { jobTitle: "Chief Financial Officer", employer: "Planned Parenthood" },
    summary: { key: "summary:professional", text: career.profile.summary, evidence: [{ type: "PROFILE", id: ids.owner }] },
    experiences: [{ experienceId: ids.experience, employer: "Example Corporation", client: null, title: "Corporate Controller", startDate: "2012-01-01", startPrecision: "YEAR", endDate: "2018-01-01", endPrecision: "YEAR", isCurrent: false, location: null, bullets: [{ key: `experience:${ids.experience}:bullet:1`, text: career.accomplishments[0].statement, evidence: [{ type: "ACCOMPLISHMENT", id: ids.accomplishment }] }] }],
    projects: [{ projectId: ids.project, name: "ASC606 Revenue Engine", bullets: [{ key: `project:${ids.project}:bullet:1`, text: career.projects[0].summary, evidence: [{ type: "PROJECT", id: ids.project }] }] }],
    skillGroups: [{ category: "SYSTEM", skills: [{ skillId: ids.skill, name: "SAP" }] }],
    education: [{ educationId: ids.education, degree: career.education[0].degree, fieldOfStudy: career.education[0].fieldOfStudy, institution: career.education[0].institution, completedOn: null }],
    credentials: [{ credentialId: ids.credential, name: "CPA Candidate", status: "CANDIDATE" }]
  };
}

describe("Gate 8 resume factual validation", () => {
  it("accepts content grounded in authoritative career evidence", () => expect(validateResumeContent(validContent(), career, job).summary.passed).toBe(true));
  it("rejects an invented title", () => { const content = validContent(); content.experiences[0].title = "Chief Financial Officer"; expect(() => validateResumeContent(content, career, job)).toThrow(/Employment facts changed/); });
  it("rejects an invented employment date", () => { const content = validContent(); content.experiences[0].startDate = "2010-01-01"; expect(() => validateResumeContent(content, career, job)).toThrow(/Employment facts changed/); });
  it("rejects an invented metric", () => { const content = validContent(); content.experiences[0].bullets[0].text = "Led finance controls and generated $20M in savings."; expect(() => validateResumeContent(content, career, job)).toThrow(/Unverified numeric claim/); });
  it("rejects CPA credential inflation", () => { const content = validContent(); content.experiences[0].bullets[0].text = "Led finance controls as the CPA for reporting."; expect(() => validateResumeContent(content, career, job)).toThrow(/cannot be represented as completed/); });
  it("rejects an unsupported Kubernetes claim", () => { const content = validContent(); content.experiences[0].bullets[0].text = "Led finance controls and Kubernetes reporting."; expect(() => validateResumeContent(content, career, job, ["Kubernetes"])).toThrow(/Unsupported requirement/); });
  it("rejects a duplicate canonical ASC 606 project", () => { const content = validContent(); content.projects.push(structuredClone(content.projects[0])); expect(() => validateResumeContent(content, career, job)).toThrow(/only once/); });
});
