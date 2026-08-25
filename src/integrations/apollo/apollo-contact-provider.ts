import { z } from "zod";
import type { EmailDiscoveryProvider } from "@/domain/providers/email-discovery-provider";
import type { PeopleDiscoveryProvider, PeopleDiscoveryRequest, ProviderResolvedOrganization } from "@/domain/providers/people-discovery-provider";
import { ConfigurationError, ProviderUnavailableError } from "@/lib/errors";
import { normalizeOrganizationName } from "@/lib/contacts/intelligence";
import { discoveredEmailSchema, discoveredPersonSchema, type ContactEmailStatus, type DiscoveredEmail, type DiscoveredPerson } from "@/lib/contacts/types";

type ApolloCredentials = { APOLLO_API_KEY: string };
type FetchLike = typeof fetch;

const APOLLO_BASE_URL = "https://api.apollo.io/api/v1";
const APOLLO_TIMEOUT_MS = 10_000;

const organizationSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(2),
  primary_domain: z.string().trim().toLowerCase().nullable().optional(),
  website_url: z.string().nullable().optional(),
  linkedin_url: z.string().nullable().optional()
}).passthrough();

const organizationResponseSchema = z.object({ organization: organizationSchema.nullable() }).passthrough();

const peopleSearchResponseSchema = z.object({
  people: z.array(z.object({
    id: z.string().trim().min(1),
    last_refreshed_at: z.string().nullable().optional()
  }).passthrough()).default([])
}).passthrough();

const apolloPersonSchema = z.object({
  id: z.string().trim().min(1),
  first_name: z.string().trim().min(1).nullable().optional(),
  last_name: z.string().trim().min(1).nullable().optional(),
  name: z.string().trim().min(2).nullable().optional(),
  title: z.string().trim().min(2).nullable().optional(),
  linkedin_url: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  email_status: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  departments: z.array(z.string()).optional().default([]),
  seniority: z.string().nullable().optional(),
  organization_id: z.string().nullable().optional(),
  organization: organizationSchema.nullable().optional()
}).passthrough();

const peopleMatchResponseSchema = z.object({ person: apolloPersonSchema.nullable() }).passthrough();

type ApolloPerson = z.infer<typeof apolloPersonSchema>;
type CachedPerson = { person: ApolloPerson; observedAt: string };

function toHttpsUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) return null;
  const domain = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return /^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(domain) ? domain : null;
}

function isoTimestamp(value: string | null | undefined, fallback: Date) {
  if (!value) return fallback.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback.toISOString() : parsed.toISOString();
}

function displayValue(value: string | null | undefined) {
  return value?.trim().replace(/_/g, " ").replace(/\s+/g, " ") || null;
}

function apolloEmailStatus(value: string | null | undefined): ContactEmailStatus {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "verified") return "VERIFIED";
  if (normalized === "extrapolated" || normalized === "likely to engage") return "LIKELY";
  if (normalized === "invalid" || normalized === "bounced") return "INVALID";
  if (normalized === "risky") return "RISKY";
  return "UNVERIFIED";
}

function usableEmail(value: string | null | undefined) {
  if (!value || value.includes("[") || value.includes("]")) return null;
  const parsed = z.string().trim().toLowerCase().email().safeParse(value);
  return parsed.success ? parsed.data : null;
}

function organizationMatches(input: PeopleDiscoveryRequest["organization"], candidate: z.infer<typeof organizationSchema>) {
  const expectedDomain = normalizeDomain(input.domain);
  const candidateDomain = normalizeDomain(candidate.primary_domain);
  if (expectedDomain && candidateDomain) return expectedDomain === candidateDomain;
  const acceptedNames = [input.canonicalName, ...input.alternateNames].map(normalizeOrganizationName).filter(Boolean);
  return acceptedNames.includes(normalizeOrganizationName(candidate.name));
}

function confidenceFor(person: ApolloPerson, organization: ProviderResolvedOrganization) {
  if (person.organization?.id && person.organization.id === organization.sourceRecordId) return 100;
  if (person.organization_id && person.organization_id === organization.sourceRecordId) return 100;
  const personDomain = normalizeDomain(person.organization?.primary_domain);
  if (organization.domain && personDomain === organization.domain) return 95;
  return normalizeOrganizationName(person.organization?.name ?? "") === normalizeOrganizationName(organization.canonicalName) ? 85 : 50;
}

export function normalizeApolloPerson(value: unknown, organization: ProviderResolvedOrganization, observedAt = new Date().toISOString()): DiscoveredPerson | null {
  const parsed = apolloPersonSchema.safeParse(value);
  if (!parsed.success || !parsed.data.title || !parsed.data.organization) return null;
  const person = parsed.data;
  const personOrganization = person.organization!;
  const fullName = displayValue(person.name) ?? displayValue([person.first_name, person.last_name].filter(Boolean).join(" "));
  if (!fullName || !person.first_name || !person.last_name) return null;
  const candidate = {
    providerKey: "apollo",
    sourceRecordId: person.id,
    fullName,
    firstName: displayValue(person.first_name),
    lastName: displayValue(person.last_name),
    currentTitle: person.title,
    department: displayValue(person.departments[0]),
    seniority: displayValue(person.seniority),
    companyName: personOrganization.name,
    companyDomain: normalizeDomain(personOrganization.primary_domain),
    location: displayValue([person.city, person.state, person.country].filter(Boolean).join(", ")),
    professionalProfileUrl: toHttpsUrl(person.linkedin_url),
    observedAt,
    providerConfidence: confidenceFor(person, organization)
  };
  const normalized = discoveredPersonSchema.safeParse(candidate);
  return normalized.success ? normalized.data : null;
}

export function normalizeApolloBusinessEmail(value: unknown, person: DiscoveredPerson, organizationDomain: string | null, observedAt = new Date().toISOString()): DiscoveredEmail | null {
  const parsed = apolloPersonSchema.safeParse(value);
  if (!parsed.success || parsed.data.id !== person.sourceRecordId) return null;
  const email = usableEmail(parsed.data.email);
  if (!email) return null;
  const emailDomain = email.split("@")[1];
  const providerDomain = normalizeDomain(parsed.data.organization?.primary_domain);
  const expectedDomain = normalizeDomain(organizationDomain) ?? providerDomain;
  if (!expectedDomain || emailDomain !== expectedDomain) return null;
  const candidate = {
    providerKey: "apollo",
    sourceRecordId: parsed.data.id,
    email,
    type: "BUSINESS" as const,
    status: apolloEmailStatus(parsed.data.email_status),
    providerStatus: displayValue(parsed.data.email_status),
    discoveredAt: observedAt,
    isPatternBased: false,
    patternEvidenceCount: 0
  };
  const normalized = discoveredEmailSchema.safeParse(candidate);
  return normalized.success ? normalized.data : null;
}

export class ApolloContactProvider implements PeopleDiscoveryProvider, EmailDiscoveryProvider {
  readonly key = "apollo";
  private readonly cache = new Map<string, CachedPerson>();

  constructor(private readonly credentials: ApolloCredentials, private readonly fetcher: FetchLike = fetch) {
    if (!credentials.APOLLO_API_KEY?.trim()) throw new ConfigurationError("Contact intelligence provider is not configured.");
  }

  private async request(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await this.fetcher(`${APOLLO_BASE_URL}${path}`, {
        ...init,
        headers: { accept: "application/json", "content-type": "application/json", "x-api-key": this.credentials.APOLLO_API_KEY, ...init.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(APOLLO_TIMEOUT_MS)
      });
    } catch (error) {
      throw new ProviderUnavailableError("Contact discovery is temporarily unavailable. Please try again.", { reason: error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError") ? "timeout" : "network" });
    }
    if (response.status === 401 || response.status === 403) throw new ConfigurationError("Apollo contact-provider credentials or API scopes need attention.");
    if (response.status === 402) throw new ProviderUnavailableError("Apollo contact-provider credits are unavailable.", { reason: "quota_exhausted" });
    if (response.status === 429) throw new ProviderUnavailableError("Apollo contact discovery has reached its provider rate limit. Please try again later.", { reason: "rate_limit" });
    if (!response.ok) throw new ProviderUnavailableError("Contact discovery is temporarily unavailable. Please try again.", { status: response.status });
    try {
      return await response.json() as unknown;
    } catch {
      throw new ProviderUnavailableError("Contact discovery returned an unreadable response.", { reason: "malformed_json" });
    }
  }

  async healthCheck() {
    await this.request("/auth/health");
    return true;
  }

  private async resolveOrganization(request: PeopleDiscoveryRequest): Promise<ProviderResolvedOrganization | null> {
    const parameters = new URLSearchParams({ name: request.organization.canonicalName });
    if (request.organization.domain) parameters.set("domain", request.organization.domain);
    const payload = await this.request(`/organizations/enrich?${parameters}`, { method: "GET" });
    const parsed = organizationResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderUnavailableError("Apollo returned an unexpected organization response.", { reason: "malformed_response" });
    if (!parsed.data.organization || !organizationMatches(request.organization, parsed.data.organization)) return null;
    const organization = parsed.data.organization;
    return {
      providerKey: this.key,
      sourceRecordId: organization.id,
      canonicalName: organization.name,
      domain: normalizeDomain(organization.primary_domain),
      alternateNames: [...new Set([request.organization.canonicalName, ...request.organization.alternateNames])],
      confidence: request.organization.domain && normalizeDomain(request.organization.domain) === normalizeDomain(organization.primary_domain) ? 100 : 90,
      sourceUrl: toHttpsUrl(organization.linkedin_url) ?? toHttpsUrl(organization.website_url)
    };
  }

  private async enrichPerson(id: string, observedAt: string) {
    const cached = this.cache.get(id);
    if (cached) return cached;
    const payload = await this.request("/people/match", { method: "POST", body: JSON.stringify({ id, reveal_personal_emails: false, reveal_phone_number: false, run_waterfall_email: false, run_waterfall_phone: false }) });
    const parsed = peopleMatchResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderUnavailableError("Apollo returned an unexpected person response.", { reason: "malformed_response" });
    if (!parsed.data.person) return null;
    const value = { person: parsed.data.person, observedAt };
    this.cache.set(id, value);
    return value;
  }

  async search(request: PeopleDiscoveryRequest) {
    const organization = await this.resolveOrganization(request);
    if (!organization) return { people: [], usage: { requests: 1, credits: null } };
    const parameters = new URLSearchParams({ include_similar_titles: "true", page: "1", per_page: String(Math.min(20, Math.max(1, request.limit))) });
    parameters.append("organization_ids[]", organization.sourceRecordId);
    if (organization.domain) parameters.append("q_organization_domains_list[]", organization.domain);
    for (const role of request.targetRoles) parameters.append("person_titles[]", role.title);
    for (const seniority of ["owner", "founder", "c_suite", "partner", "vp", "head", "director", "manager"]) parameters.append("person_seniorities[]", seniority);
    const payload = await this.request(`/mixed_people/api_search?${parameters}`, { method: "POST" });
    const parsed = peopleSearchResponseSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderUnavailableError("Apollo returned an unexpected people-search response.", { reason: "malformed_response" });
    const unique = [...new Map(parsed.data.people.map((person) => [person.id, person])).values()].slice(0, request.limit);
    const people: DiscoveredPerson[] = [];
    for (let index = 0; index < unique.length; index += 4) {
      const batch = unique.slice(index, index + 4);
      const enriched = await Promise.all(batch.map(async (summary) => {
        const observedAt = isoTimestamp(summary.last_refreshed_at, new Date());
        const match = await this.enrichPerson(summary.id, observedAt);
        return match ? normalizeApolloPerson(match.person, organization, match.observedAt) : null;
      }));
      people.push(...enriched.filter((person): person is DiscoveredPerson => Boolean(person)));
    }
    return { people, resolvedOrganization: organization, usage: { requests: 2 + unique.length, credits: null } };
  }

  async findBusinessEmails(input: { person: DiscoveredPerson; organizationDomain: string | null }) {
    const cached = this.cache.get(input.person.sourceRecordId);
    const match = cached ?? await this.enrichPerson(input.person.sourceRecordId, new Date().toISOString());
    if (!match) return { emails: [], usage: { requests: cached ? 0 : 1, credits: cached ? 0 : null } };
    const email = normalizeApolloBusinessEmail(match.person, input.person, input.organizationDomain, match.observedAt);
    return { emails: email ? [email] : [], usage: { requests: cached ? 0 : 1, credits: cached ? 0 : null } };
  }
}
