import { describe, expect, it } from "vitest";
import type { NormalizedJob } from "@/domain/providers/job-search-provider";
import { applySearchRelevance, deduplicateJobs, normalizeJobQuery, parseJobSearchInput } from "@/lib/jobs/search";

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    provider: "ADZUNA", providerJobId: "1", title: "Director, Finance Systems", companyName: "Example", companyIdentifier: null,
    locationText: "Dallas, Texas", workArrangement: "HYBRID", employmentTypes: ["FULL_TIME"], salaryMinimum: null, salaryMaximum: null,
    salaryCurrency: null, salaryPeriod: null, descriptionText: "Lead Workday automation.", postedAt: null, sourceName: "Adzuna",
    sourceUrl: "https://www.adzuna.com/details/1", applicationUrl: "https://www.adzuna.com/details/1", discoveredAt: "2026-08-24T00:00:00.000Z",
    providerMetadata: { categoryTag: null, categoryLabel: null, providerSource: null, salaryIsPredicted: false }, matchedTitleTerms: [], matchedDescriptionTerms: [], strongKeywordMatch: false,
    ...overrides
  };
}

describe("job search normalization", () => {
  it("normalizes whitespace, quoted phrases, and duplicate terms deterministically", () => {
    expect(normalizeJobQuery('  "Finance Systems"   Workday workday  automation ')).toEqual({
      originalQuery: '"Finance Systems" Workday workday automation', normalizedQuery: "Finance Systems Workday automation", normalizedTerms: ["Finance Systems", "Workday", "automation"]
    });
  });

  it("rejects empty, unclosed, and overlong queries", () => {
    expect(() => normalizeJobQuery("   ")).toThrow();
    expect(() => normalizeJobQuery('"Finance Systems')).toThrow();
    expect(() => normalizeJobQuery("x".repeat(201))).toThrow();
  });

  it("parses only supported provider filters", () => {
    const request = parseJobSearchInput({ query: "Corporate Controller", location: "Dallas", workArrangement: "REMOTE", datePostedDays: "7", employmentType: "FULL_TIME", minimumSalary: "175000", page: "2" });
    expect(request.filters).toEqual({ location: "Dallas", workArrangement: "REMOTE", datePostedDays: 7, employmentType: "FULL_TIME", minimumSalary: 175000 });
    expect(request.page).toBe(2);
  });
});

describe("job search result logic", () => {
  it("deduplicates by provider identity before URL and conservative fallback", () => {
    const values = [job(), job({ title: "Different title" }), job({ providerJobId: "2", sourceUrl: "https://www.adzuna.com/details/1?utm_source=test" }), job({ providerJobId: "3", sourceUrl: "https://www.adzuna.com/details/3" })];
    expect(deduplicateJobs(values).map((value) => value.providerJobId)).toEqual(["1", "3"]);
  });

  it("explains strong title relevance without a career-match score", () => {
    const result = applySearchRelevance(job(), ["Finance Systems", "Workday", "automation"]);
    expect(result.matchedTitleTerms).toEqual(["Finance Systems"]);
    expect(result.matchedDescriptionTerms).toEqual(["Workday", "automation"]);
    expect(result.strongKeywordMatch).toBe(true);
  });
});
