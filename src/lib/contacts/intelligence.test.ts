import { describe, expect, it } from "vitest";
import type { EmailDiscoveryProvider } from "@/domain/providers/email-discovery-provider";
import type { EmailVerificationProvider } from "@/domain/providers/email-verification-provider";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import {
  buildTargetRoleStrategy,
  chooseCurrentClaim,
  deduplicateRankedContacts,
  discoverContacts,
  isOutreachReady,
  normalizeEmailCandidate,
  rankContact
} from "@/lib/contacts/intelligence";
import type { DiscoveredPerson, RankedContact } from "@/lib/contacts/types";

const organization = { canonicalName: "Planned Parenthood of Michigan", domain: "ppmichoice.org", alternateNames: ["PPMI"] };

function person(overrides: Partial<DiscoveredPerson> = {}): DiscoveredPerson {
  return {
    providerKey: "people-a",
    sourceRecordId: "person-1",
    fullName: "Jordan Smith",
    firstName: "Jordan",
    lastName: "Smith",
    currentTitle: "Chief Executive Officer",
    department: "Executive",
    seniority: "C-Suite",
    companyName: "Planned Parenthood of Michigan",
    companyDomain: "ppmichoice.org",
    location: "Michigan",
    professionalProfileUrl: "https://example.com/jordan-smith",
    observedAt: "2026-08-25T00:00:00.000Z",
    providerConfidence: 90,
    ...overrides
  };
}

describe("Gate 9 contact intelligence", () => {
  it("targets CEO, President, and executive recruiting for a CFO role", () => {
    const roles = buildTargetRoleStrategy("Chief Financial Officer");
    expect(roles.slice(0, 2).map((item) => item.title)).toEqual(["Chief Executive Officer", "President"]);
    expect(roles.some((item) => item.title === "Executive Recruiter")).toBe(true);
  });

  it("targets CFO and CAO for a Controller role", () => {
    const roles = buildTargetRoleStrategy("Corporate Controller");
    expect(roles[0].title).toBe("Chief Financial Officer");
    expect(roles.some((item) => item.title === "Chief Accounting Officer")).toBe(true);
  });

  it("uses finance-systems-specific leaders instead of searching every role", () => {
    const roles = buildTargetRoleStrategy("Director, Finance Systems");
    expect(roles.some((item) => item.title === "Finance Systems Leader")).toBe(true);
    expect(roles.some((item) => item.title === "Accounting Systems Leader")).toBe(true);
    expect(roles.length).toBeLessThan(8);
  });

  it("rejects malformed provider people", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [{ ...person(), fullName: "" }], usage: { requests: 1, credits: 1 } }; } };
    await expect(discoverContacts({ organization, targetRoles: buildTargetRoleStrategy("Chief Financial Officer"), providers: { people, email: null, verification: null } })).rejects.toThrow();
  });

  it("does not treat a person at the wrong company as target leadership", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [person({ companyName: "Different Company", companyDomain: "different.example" })], usage: { requests: 1, credits: 1 } }; } };
    const result = await discoverContacts({ organization, targetRoles: buildTargetRoleStrategy("Chief Financial Officer"), providers: { people, email: null, verification: null } });
    expect(result.contacts).toHaveLength(0);
  });

  it("forces pattern-based candidates to UNVERIFIED and requires multiple evidence points", () => {
    const candidate = { providerKey: "email-a", sourceRecordId: "email-1", email: "jordan.smith@ppmichoice.org", type: "BUSINESS" as const, status: "VERIFIED" as const, providerStatus: "pattern", discoveredAt: "2026-08-25T00:00:00.000Z", isPatternBased: true, patternEvidenceCount: 2 };
    expect(normalizeEmailCandidate(candidate).status).toBe("UNVERIFIED");
    expect(() => normalizeEmailCandidate({ ...candidate, patternEvidenceCount: 1 })).toThrow("EMAIL_PATTERN_EVIDENCE_REQUIRED");
  });

  it("never promotes invalid or unverified email as outreach-ready", () => {
    expect(isOutreachReady("INVALID")).toBe(false);
    expect(isOutreachReady("UNVERIFIED")).toBe(false);
    expect(isOutreachReady("DELIVERABLE")).toBe(true);
  });

  it("deduplicates exact person and company matches while preserving provider provenance", () => {
    const roles = buildTargetRoleStrategy("Chief Financial Officer");
    const makeRanked = (source: DiscoveredPerson): RankedContact => {
      const rank = rankContact(source, organization, roles, null);
      return { ...source, classifications: rank.classifications, relevanceScore: rank.score, relevanceReasons: rank.reasons, dedupeKey: source.sourceRecordId.padEnd(64, "a").slice(0, 64), emails: [], provenance: [source] };
    };
    const deduped = deduplicateRankedContacts([
      makeRanked(person()),
      makeRanked(person({ providerKey: "people-b", sourceRecordId: "other-id", professionalProfileUrl: null, observedAt: "2026-08-25T01:00:00.000Z" }))
    ]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].provenance.map((item) => item.providerKey).sort()).toEqual(["people-a", "people-b"]);
  });

  it("resolves conflicting stale titles deterministically in favor of the newer claim", () => {
    const current = chooseCurrentClaim([
      { providerKey: "people-a", observedAt: "2025-01-01T00:00:00.000Z", confidence: 95, title: "Former Controller" },
      { providerKey: "people-b", observedAt: "2026-08-25T00:00:00.000Z", confidence: 80, title: "Chief Accounting Officer" }
    ]);
    expect(current?.title).toBe("Chief Accounting Officer");
  });

  it("keeps a people result usable when verification is unavailable", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [person()], usage: { requests: 1, credits: 1 } }; } };
    const email: EmailDiscoveryProvider = { key: "email-a", async findBusinessEmails() { return { emails: [{ providerKey: "email-a", sourceRecordId: "email-1", email: "jordan.smith@ppmichoice.org", type: "BUSINESS", status: "LIKELY", providerStatus: "accepted", discoveredAt: "2026-08-25T00:00:00.000Z", isPatternBased: false, patternEvidenceCount: 0 }], usage: { requests: 1, credits: 1 } }; } };
    const result = await discoverContacts({ organization, targetRoles: buildTargetRoleStrategy("Chief Financial Officer"), providers: { people, email, verification: null } });
    expect(result.status).toBe("PARTIAL");
    expect(result.contacts[0].emails[0].status).toBe("LIKELY");
  });

  it("honors an invalid verifier result without promotion", async () => {
    const people: PeopleDiscoveryProvider = { key: "people-a", async search() { return { people: [person()], usage: { requests: 1, credits: 1 } }; } };
    const email: EmailDiscoveryProvider = { key: "email-a", async findBusinessEmails() { return { emails: [{ providerKey: "email-a", sourceRecordId: "email-1", email: "jordan.smith@ppmichoice.org", type: "BUSINESS", status: "LIKELY", providerStatus: "candidate", discoveredAt: "2026-08-25T00:00:00.000Z", isPatternBased: false, patternEvidenceCount: 0 }], usage: { requests: 1, credits: 1 } }; } };
    const verification: EmailVerificationProvider = { key: "verify-a", async verify({ email }) { return { result: { providerKey: "verify-a", email, status: "INVALID", providerStatus: "undeliverable", verifiedAt: "2026-08-25T00:01:00.000Z", refreshAfter: "2026-09-24T00:01:00.000Z" }, usage: { requests: 1, credits: 1 } }; } };
    const result = await discoverContacts({ organization, targetRoles: buildTargetRoleStrategy("Chief Financial Officer"), providers: { people, email, verification } });
    expect(result.contacts[0].emails[0].verification?.status).toBe("INVALID");
    expect(isOutreachReady(result.contacts[0].emails[0].verification!.status)).toBe(false);
  });

  it("uses an explainable deterministic score", () => {
    const roles = buildTargetRoleStrategy("Chief Financial Officer");
    const first = rankContact(person(), organization, roles, "VERIFIED");
    const second = rankContact(person(), organization, roles, "VERIFIED");
    expect(first).toEqual(second);
    expect(first.score).toBeGreaterThan(70);
    expect(first.reasons.some((item) => item.includes("target organization"))).toBe(true);
  });
});
