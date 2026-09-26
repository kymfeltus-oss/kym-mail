import { describe, expect, it } from "vitest";
import { estimateBusinessEmail, extractCandidateCompanyNames, extractResumeTargetClues, identifyResumeTargetIntelligence, isAnonymousEmployer } from "@/lib/resumes/target/intelligence";

const vpFinance = `
We are seeking an operationally focused finance executive to support our client's Texas business and help build the finance capabilities of its Dallas hub.
The position will partner closely with the operational controller and the CAO.
Develop a working command of state reimbursement structures and hospital district partners.
Advanced Excel skills required; Workday Financials experience preferred.
`;

describe("resume target hidden-employer intelligence", () => {
  it("treats confidential client language as anonymous", () => {
    expect(isAnonymousEmployer("Confidential Client")).toBe(true);
    expect(isAnonymousEmployer("our client")).toBe(true);
    expect(isAnonymousEmployer("Tenet Healthcare")).toBe(false);
  });

  it("extracts healthcare, Texas, and anonymity clues from an agency brief", () => {
    const clues = extractResumeTargetClues({ title: "VP of Finance", employer: "Confidential Client", description: vpFinance });
    expect(clues.some((item) => /Texas|Dallas/i.test(item))).toBe(true);
    expect(clues.some((item) => /healthcare|reimbursement/i.test(item))).toBe(true);
    expect(clues.some((item) => /anonymous|agency/i.test(item))).toBe(true);
  });

  it("estimates first.last emails only when a domain is known", () => {
    expect(estimateBusinessEmail("Jane", "Doe", "example.com", null)).toBe("jane.doe@example.com");
    expect(estimateBusinessEmail("Jane", "Doe", null, null)).toBe("unknown");
    expect(estimateBusinessEmail("Jane", "Doe", "example.com", "jane.doe@example.com")).toBe("jane.doe@example.com");
  });

  it("does not invent a company when the employer is hidden and no provider is used", async () => {
    const result = await identifyResumeTargetIntelligence({ title: "VP of Finance", employer: "Confidential Client", description: vpFinance });
    expect(result.identified_company.company_name).toBe("Unknown");
    expect(result.primary_contacts).toEqual([]);
    expect(result.identified_company.matching_clues.length).toBeGreaterThan(0);
  });

  it("extracts organization mentions without treating confidential language as a company", () => {
    const names = extractCandidateCompanyNames("Our client, Tenet Healthcare, is expanding its Dallas hub.\nVisit careers.tenethealth.com");
    expect(names.some((item) => /Tenet/i.test(item))).toBe(true);
    expect(names.every((item) => !/confidential/i.test(item))).toBe(true);
  });
});
