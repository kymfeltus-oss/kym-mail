import { createHash } from "crypto";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import {
  discoveredEmailSchema,
  discoveredPersonSchema,
  type ContactClassification,
  type ContactEmailStatus,
  type ContactRelevanceLevel,
  type DiscoveredEmail,
  type DiscoveredPerson,
  type PersonVerificationState,
  type PostingType,
  type RankedContact,
  type TargetRole
} from "@/lib/contacts/types";

export const PERSON_DATA_FRESH_DAYS = 90;
export const CONTACT_SEARCH_COOLDOWN_MINUTES = 15;
export const CONTACT_SEARCH_LIMIT = 20;
export const CONTACT_SHORTLIST_LIMIT = 5;

const whitespace = /\s+/g;
const companySuffix = /\b(incorporated|inc|llc|ltd|limited|corporation|corp|company|co|pllc)\b/gi;

export function normalizeOrganizationName(value: string) {
  return value.normalize("NFKC").replace(/[.,]/g, " ").replace(companySuffix, " ").replace(whitespace, " ").trim().toLowerCase();
}

export function normalizePersonName(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}' -]+/gu, " ").replace(whitespace, " ").trim().toLowerCase();
}

function has(text: string, pattern: RegExp) { return pattern.test(text.toLowerCase()); }

type PostingContext = {
  title: string;
  companyName: string;
  description: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  applicationUrl: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

function hostname(value: string | null) {
  if (!value) return null;
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); } catch { return null; }
}

export function classifyPostingType(job: PostingContext): { type: PostingType; reasons: string[]; evidence: Array<{ label: string; value: string }> } {
  const combined = `${job.companyName} ${job.title} ${job.description ?? ""}`.toLowerCase();
  const sourceHost = hostname(job.sourceUrl);
  const applicationHost = hostname(job.applicationUrl);
  const evidence: Array<{ label: string; value: string }> = [];
  const agencyPattern = /\b(staffing|recruit(?:er|ing|ment)?|executive search|talent solutions|search firm|placement agency|confidential client|our client)\b/i;
  if (agencyPattern.test(combined)) {
    evidence.push({ label: "Posting language", value: "The stored posting names recruiting, staffing, search, or a confidential client." });
    return { type: "AGENCY_RECRUITER", reasons: ["Agency or recruiter language is present in the saved posting."], evidence };
  }
  const metadata = job.providerMetadata ?? {};
  if (metadata.direct_employer === true || metadata.posting_type === "DIRECT_EMPLOYER") {
    evidence.push({ label: "Provider metadata", value: "The job provider explicitly marks this as an employer posting." });
    return { type: "DIRECT_EMPLOYER", reasons: ["Structured provider evidence identifies a direct-employer posting."], evidence };
  }
  if (applicationHost && sourceHost && applicationHost !== sourceHost && !/adzuna|indeed|ziprecruiter|linkedin/.test(applicationHost)) {
    evidence.push({ label: "Application host", value: applicationHost });
    return { type: "DIRECT_EMPLOYER", reasons: ["The application link resolves away from the aggregator to a distinct employer-style host."], evidence };
  }
  if (job.sourceName) evidence.push({ label: "Source", value: job.sourceName });
  if (applicationHost) evidence.push({ label: "Application host", value: applicationHost });
  return { type: "UNKNOWN", reasons: ["The stored evidence does not establish whether the named organization posted the role directly."], evidence };
}

function addRole(roles: TargetRole[], role: TargetRole) { if (!roles.some((item) => item.title === role.title)) roles.push(role); }

export function buildTargetRoleStrategy(jobTitle: string, postingType: PostingType = "DIRECT_EMPLOYER", description = ""): TargetRole[] {
  const title = jobTitle.toLowerCase();
  const text = `${title} ${description.toLowerCase()}`;
  const roles: TargetRole[] = [];
  if (postingType === "AGENCY_RECRUITER") {
    addRole(roles, { title: "Job Poster", classification: "RECRUITER", priority: 100, reason: "For an agency posting, the named job poster is the most direct known contact." });
    addRole(roles, { title: "Executive Search Consultant", classification: "RECRUITER", priority: 94, reason: "Executive search consultants may own senior retained searches." });
    addRole(roles, { title: "Recruiter", classification: "RECRUITER", priority: 90, reason: "The recruiter is relevant without claiming knowledge of a confidential client." });
    addRole(roles, { title: "Practice Lead", classification: "TALENT_ACQUISITION", priority: 78, reason: "A finance or accounting practice lead may oversee the search." });
    addRole(roles, { title: "Agency Leader", classification: "TALENT_ACQUISITION", priority: 65, reason: "Agency leadership is a secondary route when the assigned recruiter is unavailable." });
    return roles;
  }
  if (has(title, /\bcfo\b|chief financial officer/)) {
    addRole(roles, { title: "Chief Executive Officer", classification: "EXECUTIVE_SPONSOR", priority: 100, reason: "A CFO commonly reports to the CEO; this is a relevance inference, not a hiring-manager claim." });
    addRole(roles, { title: "President", classification: "EXECUTIVE_SPONSOR", priority: 94, reason: "The president may sponsor an executive finance search." });
    addRole(roles, { title: "Board Chair", classification: "EXECUTIVE_SPONSOR", priority: 82, reason: "Board leadership may be relevant to a CFO appointment when reliable evidence exists." });
    addRole(roles, { title: "Executive Recruiter", classification: "RECRUITER", priority: 74, reason: "An executive recruiter may coordinate a CFO search." });
  } else if (has(text, /finance systems|accounting systems|erp|financial systems|technology transformation/)) {
    addRole(roles, { title: "VP Finance Systems", classification: "SYSTEMS_LEADER", priority: 100, reason: "Finance Systems leadership directly matches the role function." });
    addRole(roles, { title: "Finance Systems Leader", classification: "SYSTEMS_LEADER", priority: 96, reason: "This leader is functionally aligned with finance-platform ownership." });
    addRole(roles, { title: "Accounting Systems Leader", classification: "SYSTEMS_LEADER", priority: 91, reason: "Accounting Systems leadership is relevant to finance technology work." });
    addRole(roles, { title: "VP Finance", classification: "FINANCE_LEADER", priority: 78, reason: "Senior Finance may sponsor finance-systems transformation." });
    addRole(roles, { title: "Chief Financial Officer", classification: "EXECUTIVE_SPONSOR", priority: 68, reason: "The CFO is a possible executive sponsor, but may be less relevant than the functional leader." });
  } else if (has(title, /director.*account|account.*director/)) {
    addRole(roles, { title: "Corporate Controller", classification: "ACCOUNTING_LEADER", priority: 100, reason: "Controllership is directly aligned with senior Accounting leadership." });
    addRole(roles, { title: "Chief Accounting Officer", classification: "ACCOUNTING_LEADER", priority: 97, reason: "The CAO is a relevant senior functional leader." });
    addRole(roles, { title: "VP Accounting", classification: "ACCOUNTING_LEADER", priority: 93, reason: "VP Accounting directly aligns with the target function." });
    addRole(roles, { title: "Chief Financial Officer", classification: "EXECUTIVE_SPONSOR", priority: 74, reason: "The CFO may sponsor senior Accounting recruitment." });
  } else if (has(title, /controller/)) {
    addRole(roles, { title: "Chief Accounting Officer", classification: "ACCOUNTING_LEADER", priority: 100, reason: "The CAO is closely aligned with Controllership." });
    addRole(roles, { title: "Chief Financial Officer", classification: "FINANCE_LEADER", priority: 96, reason: "A Controller commonly reports within CFO leadership." });
    addRole(roles, { title: "VP Finance", classification: "FINANCE_LEADER", priority: 86, reason: "VP Finance may own or sponsor the Controller role." });
  } else {
    addRole(roles, { title: "Chief Financial Officer", classification: "FINANCE_LEADER", priority: 90, reason: "The CFO is a relevant senior Finance leader." });
    addRole(roles, { title: "VP Finance", classification: "FINANCE_LEADER", priority: 87, reason: "VP Finance is functionally aligned with Finance roles." });
    addRole(roles, { title: "Corporate Controller", classification: "ACCOUNTING_LEADER", priority: 84, reason: "The Corporate Controller is aligned with Accounting roles." });
  }
  addRole(roles, { title: "Talent Acquisition Leader", classification: "TALENT_ACQUISITION", priority: 58, reason: "Talent Acquisition is a secondary contact path." });
  if (postingType === "UNKNOWN") for (const role of roles) role.reason += " Posting ownership remains unverified.";
  return roles.sort((a, b) => b.priority - a.priority);
}

function tokens(value: string) { return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((item) => item.length > 1)); }
function titleSimilarity(left: string, right: string) {
  const a = tokens(left); const b = tokens(right);
  return [...a].filter((item) => b.has(item)).length / Math.max(1, Math.min(a.size, b.size));
}

export function classifyContactTitle(title: string, targetRoles: TargetRole[]): ContactClassification[] {
  const normalized = title.toLowerCase();
  const result = new Set<ContactClassification>();
  if (/chief executive|\bceo\b|president|board chair/.test(normalized)) result.add("EXECUTIVE_SPONSOR");
  if (/chief financial|\bcfo\b|vp finance|svp finance|director of finance/.test(normalized)) result.add("FINANCE_LEADER");
  if (/chief accounting|\bcao\b|controller|vp accounting|director of accounting|revenue accounting/.test(normalized)) result.add("ACCOUNTING_LEADER");
  if (/finance systems|accounting systems|enterprise systems|erp/.test(normalized)) result.add("SYSTEMS_LEADER");
  if (/talent acquisition|practice lead|agency leader/.test(normalized)) result.add("TALENT_ACQUISITION");
  if (/recruit|search consultant|job poster/.test(normalized)) result.add("RECRUITER");
  const best = targetRoles.find((role) => titleSimilarity(normalized, role.title.toLowerCase()) >= 0.45);
  if (best) result.add(best.classification);
  if ([...result].some((item) => ["ACCOUNTING_LEADER", "FINANCE_LEADER", "SYSTEMS_LEADER"].includes(item))) result.add("FUNCTIONAL_LEADER");
  if (!result.size) result.add("OTHER_RELEVANT");
  return [...result];
}

export function isOrganizationMatch(person: Pick<DiscoveredPerson, "companyName" | "companyDomain">, organization: { canonicalName: string; domain: string | null; alternateNames?: string[] }) {
  if (organization.domain && person.companyDomain && organization.domain === person.companyDomain) return true;
  const accepted = [organization.canonicalName, ...(organization.alternateNames ?? [])].map(normalizeOrganizationName).filter(Boolean);
  return accepted.includes(normalizeOrganizationName(person.companyName));
}

export function isStale(observedAt: string, days = PERSON_DATA_FRESH_DAYS, now = new Date()) { return now.getTime() - new Date(observedAt).getTime() > days * 86_400_000; }

export function verificationStateFor(person: DiscoveredPerson, now = new Date()): PersonVerificationState {
  if (isStale(person.observedAt, PERSON_DATA_FRESH_DAYS, now)) return "STALE_OR_UNCERTAIN";
  if (person.providerKey === "user-entered" || person.providerConfidence === null) return "UNVERIFIED";
  if (person.providerConfidence >= 90 && person.professionalProfileUrl) return "VERIFIED";
  if (person.providerConfidence >= 70) return "LIKELY_CURRENT";
  return "UNVERIFIED";
}

function relevanceLevel(score: number): ContactRelevanceLevel { return score >= 75 ? "HIGH" : score >= 50 ? "MEDIUM" : "LOW"; }
function recommendationLabel(classifications: ContactClassification[], postingType: PostingType) {
  if (classifications.includes("RECRUITER")) return postingType === "AGENCY_RECRUITER" ? "Recruiter / Search Contact" : "Recruiting Contact";
  if (classifications.includes("SYSTEMS_LEADER")) return "Relevant Finance Systems Leader";
  if (classifications.includes("ACCOUNTING_LEADER")) return "Recommended Accounting Leader";
  if (classifications.includes("FINANCE_LEADER")) return "Recommended Finance Leader";
  if (classifications.includes("EXECUTIVE_SPONSOR")) return "Likely Relevant Executive";
  return "Relevant Professional";
}

export function rankContact(person: DiscoveredPerson, organization: { canonicalName: string; domain: string | null; alternateNames?: string[] }, targetRoles: TargetRole[], postingType: PostingType = "DIRECT_EMPLOYER") {
  const classifications = classifyContactTitle(person.currentTitle, targetRoles);
  const best = targetRoles.map((role) => ({ role, similarity: titleSimilarity(person.currentTitle, role.title) })).sort((a, b) => b.similarity - a.similarity)[0];
  const reasons: string[] = [];
  let score = 0;
  if (isOrganizationMatch(person, organization)) { score += 20; reasons.push(postingType === "AGENCY_RECRUITER" ? "Current organization matches the identified recruiting organization." : "Current organization matches the resolved target organization."); }
  else reasons.push("Current organization does not match the resolved posting organization.");
  if (best && best.similarity > 0) { score += Math.round(45 * best.similarity * (best.role.priority / 100)); reasons.push(best.role.reason); }
  if (classifications.includes("FUNCTIONAL_LEADER")) { score += 20; reasons.push("Title aligns with the job's Finance, Accounting, or Systems function."); }
  else if (classifications.includes("RECRUITER") || classifications.includes("TALENT_ACQUISITION")) { score += postingType === "AGENCY_RECRUITER" ? 22 : 12; reasons.push("Recruiting responsibility provides a relevant process contact."); }
  if (/chief|\bceo\b|\bcfo\b|president|partner|svp|vice president|\bvp\b|director|controller|lead/i.test(person.currentTitle)) { score += 12; reasons.push("Seniority is appropriate for leadership or recruiting review."); }
  if (person.professionalProfileUrl) score += 3;
  if (!isOrganizationMatch(person, organization)) score = Math.min(score, 20);
  const bounded = Math.max(0, Math.min(100, score));
  return { score: bounded, reasons: [...new Set(reasons)], classifications, relevanceLevel: relevanceLevel(bounded), recommendationLabel: recommendationLabel(classifications, postingType) };
}

export function makeContactDedupeKey(person: Pick<DiscoveredPerson, "providerKey" | "sourceRecordId" | "professionalProfileUrl" | "fullName" | "companyName" | "currentTitle">) {
  const identity = person.sourceRecordId ? `provider:${person.providerKey}:${person.sourceRecordId}` : person.professionalProfileUrl ? `profile:${person.professionalProfileUrl.toLowerCase()}` : `person-company-title:${normalizePersonName(person.fullName)}:${normalizeOrganizationName(person.companyName)}:${person.currentTitle.toLowerCase().trim()}`;
  return createHash("sha256").update(identity).digest("hex");
}

export function makeManualContactDedupeKey(input: { fullName: string; companyName: string; currentTitle: string }) {
  return createHash("sha256").update(`manual-person-company-title:${normalizePersonName(input.fullName)}:${normalizeOrganizationName(input.companyName)}:${input.currentTitle.toLowerCase().trim()}`).digest("hex");
}

export function chooseCurrentClaim<T extends { observedAt: string; confidence: number; providerKey: string }>(claims: T[]) {
  return [...claims].sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime() || b.confidence - a.confidence || a.providerKey.localeCompare(b.providerKey))[0] ?? null;
}

export function deduplicateRankedContacts(contacts: RankedContact[]) {
  const groups = new Map<string, RankedContact>();
  for (const contact of contacts) {
    const key = contact.professionalProfileUrl ? `profile:${contact.professionalProfileUrl.toLowerCase()}` : `person-company:${normalizePersonName(contact.fullName)}:${normalizeOrganizationName(contact.companyName)}`;
    const prior = groups.get(key);
    if (!prior) groups.set(key, contact);
    else groups.set(key, {
      ...chooseCurrentClaim([{ ...prior, confidence: prior.providerConfidence ?? 0, providerKey: prior.providerKey }, { ...contact, confidence: contact.providerConfidence ?? 0, providerKey: contact.providerKey }])!,
      relevanceScore: Math.max(prior.relevanceScore, contact.relevanceScore),
      relevanceReasons: [...new Set([...prior.relevanceReasons, ...contact.relevanceReasons])],
      classifications: [...new Set([...prior.classifications, ...contact.classifications])],
      emails: [],
      provenance: [...new Map([...prior.provenance, ...contact.provenance].map((source) => [`${source.providerKey}:${source.sourceRecordId}`, source])).values()]
    });
  }
  return [...groups.values()].sort((a, b) => b.relevanceScore - a.relevanceScore || a.fullName.localeCompare(b.fullName)).slice(0, CONTACT_SHORTLIST_LIMIT);
}

export async function discoverRelevantPeople(input: { organization: { canonicalName: string; domain: string | null; alternateNames: string[] }; targetRoles: TargetRole[]; postingType: PostingType; people: PeopleDiscoveryProvider }) {
  const result = await input.people.search({ organization: input.organization, targetRoles: input.targetRoles, limit: CONTACT_SEARCH_LIMIT });
  const organization = result.resolvedOrganization ? { canonicalName: result.resolvedOrganization.canonicalName, domain: result.resolvedOrganization.domain, alternateNames: result.resolvedOrganization.alternateNames } : input.organization;
  const contacts = result.people.map((raw) => discoveredPersonSchema.parse(raw)).filter((person) => isOrganizationMatch(person, organization)).map((person): RankedContact => {
    const ranking = rankContact(person, organization, input.targetRoles, input.postingType);
    return { ...person, classifications: ranking.classifications, relevanceScore: ranking.score, relevanceReasons: ranking.reasons, relevanceLevel: ranking.relevanceLevel, recommendationLabel: ranking.recommendationLabel, verificationState: verificationStateFor(person), dedupeKey: makeContactDedupeKey(person), emails: [], provenance: [person] };
  });
  return { contacts: deduplicateRankedContacts(contacts), resolvedOrganization: result.resolvedOrganization ?? null, status: "COMPLETE" as const, usage: result.usage };
}

// Retained only for the dormant future email-provider adapter. Gate 8 never calls this.
export function normalizeEmailCandidate(candidate: DiscoveredEmail): DiscoveredEmail {
  const parsed = discoveredEmailSchema.parse(candidate);
  if (parsed.isPatternBased) {
    if (parsed.patternEvidenceCount < 2) throw new Error("EMAIL_PATTERN_EVIDENCE_REQUIRED");
    return { ...parsed, status: parsed.status === "INVALID" || parsed.status === "RISKY" ? parsed.status : "UNVERIFIED" };
  }
  return parsed;
}
export function isOutreachReady(status: ContactEmailStatus) { return status === "VERIFIED" || status === "DELIVERABLE"; }
