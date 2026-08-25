import { describe, expect, it, vi } from "vitest";
import { buildTargetRoleStrategy, discoverContacts } from "@/lib/contacts/intelligence";
import { ConfigurationError, ProviderUnavailableError } from "@/lib/errors";
import { ApolloContactProvider, normalizeApolloBusinessEmail, normalizeApolloPerson } from "./apollo-contact-provider";

const credentials = { APOLLO_API_KEY: "apollo-secret-key" };
const request = {
  organization: { canonicalName: "Planned Parenthood of Michigan", domain: "ppmichoice.org", alternateNames: ["PPMI"] },
  targetRoles: buildTargetRoleStrategy("Chief Financial Officer"),
  limit: 20
};
const resolved = {
  providerKey: "apollo",
  sourceRecordId: "org-1",
  canonicalName: "Planned Parenthood of Michigan",
  domain: "ppmichoice.org",
  alternateNames: ["Planned Parenthood of Michigan", "PPMI"],
  confidence: 100,
  sourceUrl: "https://www.linkedin.com/company/ppmi"
};

function organizationResponse(overrides: Record<string, unknown> = {}) {
  return { organization: { id: "org-1", name: "Planned Parenthood of Michigan", primary_domain: "ppmichoice.org", linkedin_url: "http://www.linkedin.com/company/ppmi", ...overrides } };
}

function personResponse(overrides: Record<string, unknown> = {}) {
  return {
    person: {
      id: "person-1",
      first_name: "Paula",
      last_name: "Greear",
      name: "Paula Greear",
      title: "President and Chief Executive Officer",
      linkedin_url: "http://www.linkedin.com/in/paula-greear",
      email: "paula@ppmichoice.org",
      email_status: "verified",
      city: "Ann Arbor",
      state: "Michigan",
      country: "United States",
      departments: ["c_suite"],
      seniority: "c_suite",
      organization_id: "org-1",
      organization: { id: "org-1", name: "Planned Parenthood of Michigan", primary_domain: "ppmichoice.org" },
      ...overrides
    }
  };
}

function providerFetcher(options: { person?: Record<string, unknown>; searchPeople?: Array<Record<string, unknown>> } = {}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    void init;
    const url = String(input);
    if (url.includes("/organizations/enrich")) return new Response(JSON.stringify(organizationResponse()), { status: 200 });
    if (url.includes("/mixed_people/api_search")) return new Response(JSON.stringify({ people: options.searchPeople ?? [{ id: "person-1", last_refreshed_at: "2026-08-25T00:00:00.000Z" }] }), { status: 200 });
    if (url.includes("/people/match")) return new Response(JSON.stringify(personResponse(options.person)), { status: 200 });
    if (url.includes("/auth/health")) return new Response(JSON.stringify({ healthy: true }), { status: 200 });
    return new Response("not found", { status: 404 });
  });
}

describe("Apollo contact provider", () => {
  it("normalizes a valid organization, person, and verified business email", async () => {
    const fetcher = providerFetcher();
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    const result = await provider.search(request);
    expect(result.resolvedOrganization).toMatchObject({ sourceRecordId: "org-1", domain: "ppmichoice.org", providerKey: "apollo" });
    expect(result.people).toHaveLength(1);
    expect(result.people[0]).toMatchObject({ fullName: "Paula Greear", currentTitle: "President and Chief Executive Officer", companyDomain: "ppmichoice.org", providerConfidence: 100 });
    const email = await provider.findBusinessEmails({ person: result.people[0], organizationDomain: "ppmichoice.org" });
    expect(email.emails[0]).toMatchObject({ email: "paula@ppmichoice.org", status: "VERIFIED", type: "BUSINESS", isPatternBased: false });
    expect(email.usage.requests).toBe(0);
    const headers = fetcher.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe(credentials.APOLLO_API_KEY);
    expect(fetcher.mock.calls.every(([url]) => !String(url).includes(credentials.APOLLO_API_KEY))).toBe(true);
  });

  it("rejects people with missing title or company data", () => {
    expect(normalizeApolloPerson(personResponse({ title: null }).person, resolved)).toBeNull();
    expect(normalizeApolloPerson(personResponse({ organization: null }).person, resolved)).toBeNull();
  });

  it("excludes a provider person whose current company does not match", async () => {
    const fetcher = providerFetcher({ person: { organization_id: "other-org", organization: { id: "other-org", name: "Different Company", primary_domain: "different.example" } } });
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    const result = await discoverContacts({ organization: request.organization, targetRoles: request.targetRoles, providers: { people: provider, email: provider, verification: null } });
    expect(result.contacts).toHaveLength(0);
  });

  it("deduplicates duplicate Apollo search IDs before enrichment", async () => {
    const fetcher = providerFetcher({ searchPeople: [{ id: "person-1" }, { id: "person-1" }] });
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    const first = await provider.search(request);
    const second = await provider.search(request);
    expect(first.people).toHaveLength(1);
    expect(second.people).toHaveLength(1);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes("/people/match"))).toHaveLength(1);
  });

  it("rejects malformed, placeholder, and non-business emails", () => {
    const person = normalizeApolloPerson(personResponse().person, resolved)!;
    expect(normalizeApolloBusinessEmail(personResponse({ email: "not-an-email" }).person, person, "ppmichoice.org")).toBeNull();
    expect(normalizeApolloBusinessEmail(personResponse({ email: "[email protected]" }).person, person, "ppmichoice.org")).toBeNull();
    expect(normalizeApolloBusinessEmail(personResponse({ email: "paula@gmail.com" }).person, person, "ppmichoice.org")).toBeNull();
  });

  it("maps verified, likely, risky, and invalid provider statuses without guessing", () => {
    const person = normalizeApolloPerson(personResponse().person, resolved)!;
    const email = (status: string) => normalizeApolloBusinessEmail(personResponse({ email_status: status }).person, person, "ppmichoice.org")?.status;
    expect(email("verified")).toBe("VERIFIED");
    expect(email("extrapolated")).toBe("LIKELY");
    expect(email("risky")).toBe("RISKY");
    expect(email("invalid")).toBe("INVALID");
  });

  it("returns a truthful empty result when organization enrichment has no match", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ organization: null }), { status: 200 }));
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    await expect(provider.search(request)).resolves.toMatchObject({ people: [] });
  });

  it.each([
    [429, "rate_limit"],
    [402, "quota_exhausted"]
  ])("sanitizes Apollo limit response %s", async (status, reason) => {
    const fetcher = vi.fn(async () => new Response("provider internals", { status }));
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    await expect(provider.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", details: { reason } });
  });

  it("sanitizes provider timeout failures", async () => {
    const fetcher = vi.fn(async () => { throw Object.assign(new Error("secret provider detail"), { name: "TimeoutError" }); });
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    await expect(provider.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE", details: { reason: "timeout" } });
  });

  it("treats invalid credentials and API scopes as configuration failures", async () => {
    const fetcher = vi.fn(async () => new Response("provider internals", { status: 403 }));
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    await expect(provider.healthCheck()).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("rejects malformed Apollo payloads", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ unexpected: true }), { status: 200 }));
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    await expect(provider.search(request)).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("does not add duplicate contacts when the same provider identity is refreshed", async () => {
    const fetcher = providerFetcher();
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    const first = await discoverContacts({ organization: request.organization, targetRoles: request.targetRoles, providers: { people: provider, email: provider, verification: null } });
    const second = await discoverContacts({ organization: request.organization, targetRoles: request.targetRoles, providers: { people: provider, email: provider, verification: null } });
    expect(first.contacts).toHaveLength(1);
    expect(second.contacts).toHaveLength(1);
    expect(first.contacts[0].dedupeKey).toBe(second.contacts[0].dedupeKey);
  });

  it("never upgrades extrapolated Apollo email to outreach-ready verification", async () => {
    const fetcher = providerFetcher({ person: { email_status: "extrapolated" } });
    const provider = new ApolloContactProvider(credentials, fetcher as typeof fetch);
    const result = await provider.search(request);
    const email = await provider.findBusinessEmails({ person: result.people[0], organizationDomain: "ppmichoice.org" });
    expect(email.emails[0].status).toBe("LIKELY");
  });
});
