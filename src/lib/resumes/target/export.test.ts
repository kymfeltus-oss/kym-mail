import { describe, expect, it } from "vitest";
import { renderTargetResumeDocx, renderTargetResumePdf } from "@/lib/resumes/target/export";
import { targetResumeContentSchema } from "@/lib/resumes/target/types";

const content = targetResumeContentSchema.parse({
  candidate: { fullName: "Kym Feltus", headline: "Finance systems executive", location: "Dallas, TX", email: "kym@kymmailapp.com", phone: "945-418-7325", linkedin: "https://www.linkedin.com/in/kym-feltus-securafinai/" },
  target: { jobTitle: "Accounting Manager", employer: "Evlo AI" },
  thesis: "Finance systems executive composed for Evlo AI.",
  summary: "Transforms close, consolidation, and reporting.",
  highlights: [],
  experiences: [{
    experienceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    employer: "Georgia-Pacific",
    client: null,
    title: "Assistant Corporate Controller",
    startDate: "2018-01-01",
    startPrecision: "YEAR",
    endDate: "2022-01-01",
    endPrecision: "YEAR",
    isCurrent: false,
    location: "Atlanta, GA",
    bullets: ["Reduced audit findings by sixty percent through strengthened controls."]
  }],
  projects: [],
  skillGroups: [{ category: "ACCOUNTING", skills: [{ skillId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "ASC 606" }] }],
  education: [{ educationId: "99999999-9999-4999-8999-999999999999", degree: "Bachelor of Science", fieldOfStudy: "Accounting", institution: "University of North Texas", completedOn: null }],
  credentials: [{ credentialId: "88888888-8888-4888-8888-888888888888", name: "CPA Candidate", status: "CANDIDATE" }],
  confirmedCapabilities: []
});

describe("targeted resume export", () => {
  it("writes a PDF and a Word file for the selected style", async () => {
    const style = { layout: "sidebar" as const, color: "navy" as const, type: "editorial" as const, header: "band" as const };
    const pdf = await renderTargetResumePdf(content, style);
    const docx = await renderTargetResumeDocx(content, style);
    expect(pdf.subarray(0, 5).toString("utf8")).toBe("%PDF-");
    expect(docx.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(pdf.length).toBeGreaterThan(1000);
    expect(docx.length).toBeGreaterThan(1000);
  });
});
