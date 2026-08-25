import { createHash } from "crypto";
import type { EmailDiscoveryProvider } from "@/domain/providers/email-discovery-provider";
import type { EmailVerificationProvider } from "@/domain/providers/email-verification-provider";
import type { PeopleDiscoveryProvider } from "@/domain/providers/people-discovery-provider";
import {
  discoveredEmailSchema,
  discoveredPersonSchema,
  verificationResultSchema,
  type ContactClassification,
  type ContactEmailStatus,
  type DiscoveredEmail,
  type DiscoveredPerson,
  type RankedContact,
  type TargetRole
} from "@/lib/contacts/types";

export const PERSON_DATA_FRESH_DAYS = 90;
export const EMAIL_VERIFICATION_FRESH_DAYS = 30;
export const CONTACT_SEARCH_COOLDOWN_MINUTES = 15;
export const CONTACT_SEARCH_LIMIT = 20;

const whitespace = /\s+/g;
const companySuffix = /\b(incorporated|inc|llc|ltd|limited|corporation|corp|company|co|pllc)\b/gi;

export function normalizeOrganizationName(value: string) {
  return value.normalize("NFKC").replace(/[.,]/g, " ").replace(companySuffix, " ").replace(whitespace, " ").trim().toLowerCase();
}

export function normalizePersonName(value: string) {
  return value.normalize("NFKC").replace(/[^\p{L}\p{N}' -]+/gu, " ").replace(whitespace, " ").trim().toLowerCase();
}

function has(text: string, pattern: RegExp) {
  return pattern.test(text.toLowerCase());
}

export function buildTargetRoleStrategy(jobTitle: string): TargetRole[] {
  const title = jobTitle.toLowerCase();
  const roles: TargetRole[] = [];
  const add = (role: TargetRole) => { if (!roles.some((item) => item.title === role.title)) roles.push(role); };
  if (has(title, /\bcfo\b|chief financial officer/)) {
    add({ title: "Chief Executive Officer", classification: "LIKELY_HIRING_MANAGER", priority: 100, reason: "A CFO commonly reports to the chief executive or president." });
    add({ title: "President", classification: "EXECUTIVE_SPONSOR", priority: 92, reason: "The president may sponsor or participate in a CFO search." });
    add({ title: "Executive Recruiter", classification: "RECRUITER", priority: 72, reason: "Executive recruiting may coordinate a CFO search." });
    add({ title: "Talent Acquisition Leader", classification: "TALENT_ACQUISITION", priority: 62, reason: "Talent Acquisition may coordinate the recruiting process." });
  } else if (has(title, /finance systems|accounting systems|erp|financial systems/)) {
    add({ title: "VP Finance", classification: "LIKELY_HIRING_MANAGER", priority: 96, reason: "Finance systems leadership commonly reports into senior Finance." });
    add({ title: "Finance Systems Leader", classification: "SYSTEMS_LEADER", priority: 94, reason: "The role aligns directly with Finance Systems leadership." });
    add({ title: "Accounting Systems Leader", classification: "SYSTEMS_LEADER", priority: 90, reason: "Accounting Systems leadership is functionally aligned." });
    add({ title: "Chief Financial Officer", classification: "EXECUTIVE_SPONSOR", priority: 82, reason: "The CFO may sponsor finance-technology transformation." });
    add({ title: "Enterprise Systems Leader", classification: "SYSTEMS_LEADER", priority: 65, reason: "Enterprise Systems may partner on finance-platform ownership." });
  } else if (has(title, /director.*account|account.*director/)) {
    add({ title: "Corporate Controller", classification: "LIKELY_HIRING_MANAGER", priority: 100, reason: "A Director of Accounting commonly reports to the Corporate Controller." });
    add({ title: "Chief Accounting Officer", classification: "ACCOUNTING_LEADER", priority: 96, reason: "The CAO is a probable functional leader for senior Accounting roles." });
    add({ title: "VP Accounting", classification: "ACCOUNTING_LEADER", priority: 92, reason: "VP Accounting is directly aligned with the role." });
    add({ title: "Chief Financial Officer", classification: "EXECUTIVE_SPONSOR", priority: 78, reason: "The CFO may sponsor senior Accounting recruitment." });
  } else if (has(title, /controller/)) {
    add({ title: "Chief Financial Officer", classification: "LIKELY_HIRING_MANAGER", priority: 100, reason: "A Controller commonly reports to the CFO." });
    add({ title: "Chief Accounting Officer", classification: "ACCOUNTING_LEADER", priority: 96, reason: "The CAO is a probable functional leader for Controllership." });
    add({ title: "VP Finance", classification: "FINANCE_LEADER", priority: 90, reason: "VP Finance may own or sponsor the Controller role." });
    add({ title: "Corporate Controller", classification: "ACCOUNTING_LEADER", priority: 82, reason: "An existing Corporate Controller may be the direct or skip-level leader." });
  } else {
    add({ title: "Chief Financial Officer", classification: "EXECUTIVE_SPONSOR", priority: 85, reason: "The CFO is a relevant executive sponsor for Finance and Accounting work." });
    add({ title: "VP Finance", classification: "FINANCE_LEADER", priority: 82, reason: "VP Finance is functionally aligned with Finance roles." });
    add({ title: "Corporate Controller", classification: "ACCOUNTING_LEADER", priority: 80, reason: "The Corporate Controller is functionally aligned with Accounting roles." });
  }
  add({ title: "Corporate Recruiter", classification: "RECRUITER", priority: 55, reason: "Recruiting is a secondary contact path when a functional leader is unavailable." });
  return roles.sort((a, b) => b.priority - a.priority);
}

export function classifyContactTitle(title: string, targetRoles: TargetRole[]): ContactClassification[] {
  const normalized = title.toLowerCase();
  const result = new Set<ContactClassification>();
  if (/chief executive|\bceo\b|president/.test(normalized)) result.add("EXECUTIVE_SPONSOR");
  if (/chief financial|\bcfo\b|vp finance|svp finance|director of finance/.test(normalized)) result.add("FINANCE_LEADER");
  if (/chief accounting|\bcao\b|controller|vp accounting|director of accounting|revenue accounting/.test(normalized)) result.add("ACCOUNTING_LEADER");
  if (/finance systems|accounting systems|enterprise systems|erp/.test(normalized)) result.add("SYSTEMS_LEADER");
  if (/talent acquisition/.test(normalized)) result.add("TALENT_ACQUISITION");
  if (/recruit/.test(normalized)) result.add("RECRUITER");
  const bestTarget = targetRoles.find((role) => titleSimilarity(normalized, role.title.toLowerCase()) >= 0.45);
  if (bestTarget) {
    result.add(bestTarget.classification);
    if (bestTarget.priority >= 90) result.add("LIKELY_HIRING_MANAGER");
  }
  if ([...result].some((item) => ["ACCOUNTING_LEADER", "FINANCE_LEADER", "SYSTEMS_LEADER"].includes(item))) result.add("FUNCTIONAL_LEADER");
  if (!result.size) result.add("OTHER_RELEVANT");
  return [...result];
}

function tokens(value: string) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter((item) => item.length > 1));
}

function titleSimilarity(left: string, right: string) {
  const a = tokens(left); const b = tokens(right);
  const intersection = [...a].filter((item) => b.has(item)).length;
  return intersection / Math.max(1, Math.min(a.size, b.size));
}

export function isOrganizationMatch(person: Pick<DiscoveredPerson, "companyName" | "companyDomain">, organization: { canonicalName: string; domain: string | null; alternateNames?: string[] }) {
  if (organization.domain && person.companyDomain && organization.domain === person.companyDomain) return true;
  const accepted = [organization.canonicalName, ...(organization.alternateNames ?? [])].map(normalizeOrganizationName).filter(Boolean);
  return accepted.includes(normalizeOrganizationName(person.companyName));
}

function emailScore(status: ContactEmailStatus | null) {
  return status === "VERIFIED" ? 10 : status === "DELIVERABLE" ? 9 : status === "LIKELY" ? 5 : status === "UNVERIFIED" ? 2 : 0;
}

export function rankContact(person: DiscoveredPerson, organization: { canonicalName: string; domain: string | null; alternateNames?: string[] }, targetRoles: TargetRole[], emailStatus: ContactEmailStatus | null = null) {
  const classifications = classifyContactTitle(person.currentTitle, targetRoles);
  const best = targetRoles.map((role) => ({ role, similarity: titleSimilarity(person.currentTitle, role.title) })).sort((a, b) => b.similarity - a.similarity)[0];
  const reasons: string[] = [];
  let score = 0;
  if (isOrganizationMatch(person, organization)) { score += 10; reasons.push("Current employer matches the target organization."); }
  else reasons.push("Employer does not match the resolved target organization.");
  if (best && best.similarity > 0) {
    const reporting = Math.round(35 * best.similarity * (best.role.priority / 100));
    score += reporting;
    reasons.push(best.role.reason);
  }
  if (classifications.includes("FUNCTIONAL_LEADER")) { score += 25; reasons.push("Title is aligned with the target Finance, Accounting, or Systems function."); }
  else if (classifications.includes("RECRUITER") || classifications.includes("TALENT_ACQUISITION")) { score += 15; reasons.push("Recruiting responsibility provides a secondary contact path."); }
  if (/chief|\bceo\b|\bcfo\b|president|svp|vice president|\bvp\b|director|controller/i.test(person.currentTitle)) { score += 15; reasons.push("Seniority is appropriate for decision-maker review."); }
  score += emailScore(emailStatus);
  if (emailScore(emailStatus) >= 9) reasons.push("A provider-verified business email is available.");
  if (person.professionalProfileUrl) score += 3;
  if (person.department) score += 2;
  if (!isOrganizationMatch(person, organization)) score = Math.min(score, 20);
  return { score: Math.min(100, score), reasons: [...new Set(reasons)], classifications };
}

export function makeContactDedupeKey(person: Pick<DiscoveredPerson, "providerKey" | "sourceRecordId" | "professionalProfileUrl" | "fullName" | "companyName" | "currentTitle">, verifiedEmail?: string | null) {
  const identity = person.sourceRecordId
    ? `provider:${person.providerKey}:${person.sourceRecordId}`
    : person.professionalProfileUrl
      ? `profile:${person.professionalProfileUrl.toLowerCase()}`
      : verifiedEmail
        ? `email:${verifiedEmail.toLowerCase()}`
        : `person-company-title:${normalizePersonName(person.fullName)}:${normalizeOrganizationName(person.companyName)}:${person.currentTitle.toLowerCase().trim()}`;
  return createHash("sha256").update(identity).digest("hex");
}

export function makeManualContactDedupeKey(input: { fullName: string; companyName: string; currentTitle: string; email?: string | null }) {
  const identity = input.email
    ? `manual-email:${input.email.toLowerCase()}`
    : `manual-person-company-title:${normalizePersonName(input.fullName)}:${normalizeOrganizationName(input.companyName)}:${input.currentTitle.toLowerCase().trim()}`;
  return createHash("sha256").update(identity).digest("hex");
}

export function normalizeEmailCandidate(candidate: DiscoveredEmail): DiscoveredEmail {
  const parsed = discoveredEmailSchema.parse(candidate);
  if (parsed.isPatternBased) {
    if (parsed.patternEvidenceCount < 2) throw new Error("EMAIL_PATTERN_EVIDENCE_REQUIRED");
    return { ...parsed, status: parsed.status === "INVALID" || parsed.status === "RISKY" ? parsed.status : "UNVERIFIED" };
  }
  return parsed;
}

export function isOutreachReady(status: ContactEmailStatus) {
  return status === "VERIFIED" || status === "DELIVERABLE";
}

export function isStale(observedAt: string, days: number, now = new Date()) {
  return now.getTime() - new Date(observedAt).getTime() > days * 86_400_000;
}

export function chooseCurrentClaim<T extends { observedAt: string; confidence: number; providerKey: string }>(claims: T[]) {
  return [...claims].sort((a, b) => {
    const freshness = new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime();
    if (freshness) return freshness;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.providerKey.localeCompare(b.providerKey);
  })[0] ?? null;
}

export function deduplicateRankedContacts(contacts: RankedContact[]) {
  const groups = new Map<string, RankedContact>();
  const aliases = new Map<string, string>();
  for (const contact of contacts) {
    const profileKey = contact.professionalProfileUrl?.toLowerCase();
    const verified = contact.emails.find((email) => email.verification && isOutreachReady(email.verification.status))?.email.toLowerCase();
    const identityKeys = [
      profileKey ? `profile:${profileKey}` : null,
      verified ? `email:${verified}` : null,
      `person-company:${normalizePersonName(contact.fullName)}:${normalizeOrganizationName(contact.companyName)}`
    ].filter((item): item is string => Boolean(item));
    const key = identityKeys.map((identity) => aliases.get(identity)).find(Boolean) ?? identityKeys[0];
    const prior = groups.get(key);
    if (!prior) groups.set(key, contact);
    else groups.set(key, {
      ...chooseCurrentClaim([
        { ...prior, confidence: prior.providerConfidence ?? 0, observedAt: prior.observedAt, providerKey: prior.providerKey },
        { ...contact, confidence: contact.providerConfidence ?? 0, observedAt: contact.observedAt, providerKey: contact.providerKey }
      ])!,
      relevanceScore: Math.max(prior.relevanceScore, contact.relevanceScore),
      relevanceReasons: [...new Set([...prior.relevanceReasons, ...contact.relevanceReasons])],
      classifications: [...new Set([...prior.classifications, ...contact.classifications])],
      emails: [...new Map([...prior.emails, ...contact.emails].map((email) => [email.email.toLowerCase(), email])).values()],
      provenance: [...new Map([...prior.provenance, ...contact.provenance].map((source) => [`${source.providerKey}:${source.sourceRecordId}`, source])).values()]
    });
    for (const identity of identityKeys) aliases.set(identity, key);
  }
  return [...groups.values()].sort((a, b) => b.relevanceScore - a.relevanceScore || a.fullName.localeCompare(b.fullName));
}

export async function discoverContacts(input: {
  organization: { canonicalName: string; domain: string | null; alternateNames: string[] };
  targetRoles: TargetRole[];
  providers: { people: PeopleDiscoveryProvider; email: EmailDiscoveryProvider | null; verification: EmailVerificationProvider | null };
}) {
  const peopleResult = await input.providers.people.search({ organization: input.organization, targetRoles: input.targetRoles, limit: CONTACT_SEARCH_LIMIT });
  const organization = peopleResult.resolvedOrganization
    ? { canonicalName: peopleResult.resolvedOrganization.canonicalName, domain: peopleResult.resolvedOrganization.domain, alternateNames: peopleResult.resolvedOrganization.alternateNames }
    : input.organization;
  const people = peopleResult.people.map((person) => discoveredPersonSchema.parse(person)).filter((person) => isOrganizationMatch(person, organization));
  const ranked: RankedContact[] = [];
  const usage = {
    people: peopleResult.usage,
    email: { requests: 0, credits: 0 as number | null },
    verification: { requests: 0, credits: 0 as number | null }
  };
  const addUsage = (target: { requests: number; credits: number | null }, value: { requests: number; credits: number | null }) => {
    target.requests += value.requests;
    target.credits = target.credits === null || value.credits === null ? null : target.credits + value.credits;
  };
  let partial = !input.providers.email || !input.providers.verification;
  for (const person of people) {
    const emails: RankedContact["emails"] = [];
    if (input.providers.email) {
      try {
        const result = await input.providers.email.findBusinessEmails({ person, organizationDomain: organization.domain });
        addUsage(usage.email, result.usage);
        for (const raw of result.emails) {
          const email = normalizeEmailCandidate(raw);
          let verification = null;
          if (input.providers.verification && !email.isPatternBased && email.status !== "INVALID") {
            try {
              const verificationResponse = await input.providers.verification.verify({ email: email.email });
              addUsage(usage.verification, verificationResponse.usage);
              verification = verificationResultSchema.parse(verificationResponse.result);
            }
            catch { partial = true; }
          }
          emails.push({ ...email, verification });
        }
      } catch { partial = true; }
    }
    const bestStatus = emails.map((email) => email.verification?.status ?? email.status).sort((a, b) => emailScore(b) - emailScore(a))[0] ?? null;
    const rank = rankContact(person, organization, input.targetRoles, bestStatus);
    ranked.push({ ...person, classifications: rank.classifications, relevanceScore: rank.score, relevanceReasons: rank.reasons, dedupeKey: makeContactDedupeKey(person, emails.find((item) => item.verification && isOutreachReady(item.verification.status))?.email), emails, provenance: [person] });
  }
  return { contacts: deduplicateRankedContacts(ranked), resolvedOrganization: peopleResult.resolvedOrganization ?? null, status: partial ? "PARTIAL" as const : "COMPLETE" as const, usage };
}
