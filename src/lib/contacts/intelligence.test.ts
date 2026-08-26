import { describe, expect, it } from "vitest";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import {
  buildTargetRoleStrategy,
  chooseCurrentClaim,
  classifyContactTitle,
  classifyPostingType,
  deduplicateRankedContacts,
  discoverRelevantPeople,
  rankContact,
  verificationStateFor
} from "@/lib/contacts/intelligence";
import type { DiscoveredPerson, RankedContact } from "@/lib/contacts/types";

const organization = { canonicalName: "Planned Parenthood of Michigan", domain: "ppmichoice.org", alternateNames: ["PPMI"] };

function person(overrides: Partial<DiscoveredPerson> = {}): DiscoveredPerson {
  return { providerKey: "people-a", sourceRecordId: "person-1", fullName: "Jordan Smith", firstName: "Jordan", lastName: "Smith", currentTitle: "Chief Executive Officer", department: "Executive", seniority: "C-Suite", companyName: "Planned Parenthood of Michigan", companyDomain: "ppmichoice.org", location: "Michigan", professionalProfileUrl: "https://example.com/jordan-smith", observedAt: "2026-08-25T00:00:00.000Z", providerConfidence: 95, ...overrides };
}

describe("Gate 8 hiring intelligence", () => {
  it("classifies explicit recruiting language as an agency posting", () => {
    expect(classifyPostingType({ title: "CFO", companyName: "Search Partners", description: "Our confidential client needs a CFO", sourceName: "Adzuna", sourceUrl: "https://adzuna.example/job", applicationUrl: "https://adzuna.example/app" }).type).toBe("AGENCY_RECRUITER");
  });

  it("keeps an aggregator posting UNKNOWN without direct-employer evidence", () => {
    expect(classifyPostingType({ title: "Controller", companyName: "Example Corp", description: "Lead accounting", sourceName: "Adzuna", sourceUrl: "https://adzuna.example/job", applicationUrl: "https://adzuna.example/app" }).type).toBe("UNKNOWN");
  });

  it("uses an agency-specific strategy without reverse-engineering a hidden client", () => {
    const roles = buildTargetRoleStrategy("Chief Financial Officer", "AGENCY_RECRUITER");
    expect(roles[0].title).toBe("Job Poster");
    expect(roles.some((role) => role.title === "Recruiter")).toBe(true);
    expect(roles.some((role) => role.title === "Chief Executive Officer")).toBe(false);
  });

  it("targets CEO and President for a CFO role without calling either the hiring manager", () => {
    const roles = buildTargetRoleStrategy("Chief Financial Officer", "DIRECT_EMPLOYER");
    expect(roles.slice(0, 2).map((item) => item.title)).toEqual(["Chief Executive Officer", "President"]);
    expect(roles.flatMap((role) => [role.title, role.reason, role.classification]).join(" ")).not.toMatch(/LIKELY_HIRING_MANAGER/);
  });

  it("prioritizes Finance Systems leadership over the CFO for systems work", () => {
    const roles = buildTargetRoleStrategy("Senior Manager, Finance Systems", "DIRECT_EMPLOYER", "ERP technology transformation");
    expect(roles[0].title).toBe("VP Finance Systems");
    expect(roles.findIndex((role) => role.title === "Chief Financial Officer")).toBeGreaterThan(0);
  });

  it("never emits an unsupported hiring-manager classification", () => {
    expect(classifyContactTitle("Chief Executive Officer", buildTargetRoleStrategy("CFO"))).not.toContain("LIKELY_HIRING_MANAGER");
  });

  it("rejects malformed people-provider records", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [{ ...person(), fullName: "" }], usage: { requests: 1, credits: 1 } }; } };
    await expect(discoverRelevantPeople({ organization, targetRoles: buildTargetRoleStrategy("CFO"), postingType: "DIRECT_EMPLOYER", people })).rejects.toThrow();
  });

  it("excludes a person at the wrong current organization", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [person({ companyName: "Different Company", companyDomain: "different.example" })], usage: { requests: 1, credits: 1 } }; } };
    const result = await discoverRelevantPeople({ organization, targetRoles: buildTargetRoleStrategy("CFO"), postingType: "DIRECT_EMPLOYER", people });
    expect(result.contacts).toHaveLength(0);
  });

  it("separates verification quality from relevance", () => {
    const roles = buildTargetRoleStrategy("CFO");
    const current = person();
    expect(verificationStateFor(current, new Date("2026-08-26T00:00:00.000Z"))).toBe("VERIFIED");
    const rank = rankContact(current, organization, roles);
    expect(rank.relevanceLevel).toBe("HIGH");
  });

  it("marks old provider evidence stale or uncertain", () => {
    expect(verificationStateFor(person({ observedAt: "2025-01-01T00:00:00.000Z" }), new Date("2026-08-26T00:00:00.000Z"))).toBe("STALE_OR_UNCERTAIN");
  });

  it("labels manual people UNVERIFIED", () => {
    expect(verificationStateFor(person({ providerKey: "user-entered", providerConfidence: null }), new Date("2026-08-26T00:00:00.000Z"))).toBe("UNVERIFIED");
  });

  it("deduplicates the same person while preserving provenance", () => {
    const roles = buildTargetRoleStrategy("CFO");
    const makeRanked = (source: DiscoveredPerson): RankedContact => {
      const rank = rankContact(source, organization, roles);
      return { ...source, classifications: rank.classifications, relevanceScore: rank.score, relevanceReasons: rank.reasons, relevanceLevel: rank.relevanceLevel, recommendationLabel: rank.recommendationLabel, verificationState: verificationStateFor(source), dedupeKey: source.sourceRecordId.padEnd(64, "a").slice(0, 64), emails: [], provenance: [source] };
    };
    const result = deduplicateRankedContacts([makeRanked(person()), makeRanked(person({ providerKey: "people-b", sourceRecordId: "person-2", observedAt: "2026-08-25T01:00:00.000Z" }))]);
    expect(result).toHaveLength(1);
    expect(result[0].provenance.map((source) => source.providerKey).sort()).toEqual(["people-a", "people-b"]);
  });

  it("uses newer role evidence when providers conflict", () => {
    const current = chooseCurrentClaim([{ providerKey: "old", observedAt: "2025-01-01T00:00:00.000Z", confidence: 99, title: "Former Controller" }, { providerKey: "new", observedAt: "2026-08-25T00:00:00.000Z", confidence: 80, title: "Chief Accounting Officer" }]);
    expect(current?.title).toBe("Chief Accounting Officer");
  });

  it("returns no more than five useful people", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: Array.from({ length: 8 }, (_, index) => person({ sourceRecordId: `person-${index}`, fullName: `Person ${index}`, firstName: "Person", lastName: String(index), professionalProfileUrl: `https://example.com/person-${index}` })), usage: { requests: 10, credits: null } }; } };
    const result = await discoverRelevantPeople({ organization, targetRoles: buildTargetRoleStrategy("CFO"), postingType: "DIRECT_EMPLOYER", people });
    expect(result.contacts).toHaveLength(5);
  });
});
