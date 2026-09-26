import { z } from "zod";
import { ApolloContactProvider } from "@/integrations/apollo/apollo-contact-provider";
import { buildTargetRoleStrategy, detectPrivateEquityContext } from "@/lib/contacts/intelligence";
import { getContactProviders } from "@/lib/contacts/providers";
import { hasContactProviderEnv } from "@/lib/env";

export const resumeTargetIntelligenceSchema = z.object({
  identified_company: z.object({
    company_name: z.string().trim().min(1).max(200),
    confidence_score_percentage: z.number().int().min(0).max(100),
    matching_clues: z.array(z.string().trim().min(2).max(300)).max(20)
  }),
  primary_contacts: z.array(z.object({
    full_name: z.string().trim().min(2).max(160),
    job_title: z.string().trim().min(2).max(200),
    linkedin_url: z.string().url().nullable(),
    estimated_email: z.string().trim().min(1).max(254)
  })).max(2)
});
export type ResumeTargetIntelligence = z.infer<typeof resumeTargetIntelligenceSchema>;

const placeholderEmployer = /\b(confidential|hidden client|our client|the client|undisclosed|unknown|n\/a|tbd|recruiting firm|search firm|staffing|agency)\b/i;
const genericName = /^(client|confidential|unknown|hidden|confidential client|our client|the client)$/i;
const skipName = /\b(united states|north america|job description|equal opportunity|human resources|private equity)\b/i;

export function isAnonymousEmployer(employer: string) {
  const value = employer.trim();
  return !value || placeholderEmployer.test(value) || genericName.test(value);
}

export function extractCandidateCompanyNames(text: string) {
  const names = new Set<string>();
  const sponsor = detectPrivateEquityContext({ title: "", companyName: "", description: text, sourceName: null, sourceUrl: null, applicationUrl: null });
  if (sponsor?.sponsorName && !isAnonymousEmployer(sponsor.sponsorName)) names.add(sponsor.sponsorName);
  for (const match of text.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.(?:com|org|net|io|health|care))\b/gi)) {
    const host = match[1]?.toLowerCase();
    if (host && !/^(linkedin|indeed|glassdoor|google|microsoft)\./.test(host)) names.add(host);
  }
  for (const match of text.matchAll(/\b([A-Z][A-Za-z0-9&'.-]{1,40}(?:\s+[A-Z][A-Za-z0-9&'.-]{1,40}){0,4})\s+(?:Inc|LLC|Ltd|Corp|Corporation|Company|Group|Partners|Holdings|Health|Healthcare|Hospital|System)\b/g)) {
    const value = match[0].replace(/\s+/g, " ").trim();
    if (value.length >= 4 && !skipName.test(value) && !isAnonymousEmployer(value)) names.add(value);
  }
  return [...names].slice(0, 5);
}

export function extractResumeTargetClues(input: { title: string; employer: string; description: string }) {
  const text = `${input.title}\n${input.employer}\n${input.description}`;
  const clues: string[] = [];
  const locations = [...text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/g)].map((item) => `${item[1]}, ${item[2]}`);
  const namedPlaces = [...text.matchAll(/\b(Dallas|Houston|Austin|San Antonio|Fort Worth|Chicago|Atlanta|New York|Los Angeles|Boston|Denver|Phoenix|Miami|Seattle|Texas|TX)\b/g)].map((item) => item[1]);
  const geography = [...new Set([...locations, ...namedPlaces])];
  if (geography.length) clues.push(`Geography: ${geography.join(", ")}`);
  if (/\bhealthcare|hospital|reimbursement|hospital district|facility leaders?|market presidents?\b/i.test(text)) {
    clues.push("Healthcare / multi-site operations with reimbursement and facility leadership");
  }
  if (/\b(saas|software|fintech|manufacturing|logistics|energy|retail|hospitality)\b/i.test(text)) {
    clues.push("Industry language names a specific operating sector");
  }
  if (/\b(private equity|pe-backed|sponsor|portfolio|series [a-d]|venture-backed|ipo)\b/i.test(text)) {
    clues.push("Private-equity, sponsor, or funded-company language");
  }
  if (/\bour client|confidential|hidden|undisclosed\b/i.test(text) || isAnonymousEmployer(input.employer)) {
    clues.push("Anonymous or agency-style posting that hides the employer");
  }
  if (/\b(cao|chief accounting officer|operational controller|controller|cfo|chief financial officer)\b/i.test(text)) {
    clues.push("Internal finance structure names a controller, CAO, and/or CFO");
  }
  if (/\b(acquisition|new markets|expansion|dallas hub|service center)\b/i.test(text)) {
    clues.push("Growth, acquisition, or new-market expansion mandate");
  }
  const systems = [...text.matchAll(/\b(Workday|NetSuite|SAP|Oracle|Salesforce)\b/g)].map((item) => item[1]);
  if (systems.length) clues.push(`Named systems: ${[...new Set(systems)].join(", ")}`);
  if (input.employer.trim() && !isAnonymousEmployer(input.employer)) clues.push(`Posted employer name: ${input.employer.trim()}`);
  for (const name of extractCandidateCompanyNames(text)) clues.push(`Organization mention in the brief: ${name}`);
  return [...new Set(clues)].slice(0, 12);
}

export function estimateBusinessEmail(firstName: string, lastName: string, domain: string | null, discoveredEmail: string | null) {
  if (discoveredEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(discoveredEmail)) return discoveredEmail.toLowerCase();
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (!domain || !first || !last) return "unknown";
  return `${first}.${last}@${domain}`;
}

function emptyIntelligence(clues: string[]): ResumeTargetIntelligence {
  return resumeTargetIntelligenceSchema.parse({
    identified_company: {
      company_name: "Unknown",
      confidence_score_percentage: clues.length ? 15 : 0,
      matching_clues: clues.length ? clues : ["The job description does not name a verifiable employer."]
    },
    primary_contacts: []
  });
}

function namedEmployerOnly(name: string, clues: string[]): ResumeTargetIntelligence {
  return resumeTargetIntelligenceSchema.parse({
    identified_company: {
      company_name: name,
      confidence_score_percentage: 42,
      matching_clues: clues
    },
    primary_contacts: []
  });
}

function safeLinkedIn(value: string | null) {
  return value && z.string().url().safeParse(value).success ? value : null;
}

export async function identifyResumeTargetIntelligence(input: { title: string; employer: string; description: string }): Promise<ResumeTargetIntelligence> {
  const clues = extractResumeTargetClues(input);
  const namedEmployer = isAnonymousEmployer(input.employer) ? null : input.employer.trim();
  const candidates = [...new Set([namedEmployer, ...extractCandidateCompanyNames(`${input.title}\n${input.employer}\n${input.description}`)].filter((item): item is string => Boolean(item)))];
  if (!hasContactProviderEnv()) {
    return namedEmployer ? namedEmployerOnly(namedEmployer, clues) : emptyIntelligence(clues);
  }

  const providers = getContactProviders();
  if (!providers.people) return namedEmployer ? namedEmployerOnly(namedEmployer, clues) : emptyIntelligence(clues);

  const targetRoles = buildTargetRoleStrategy(input.title, namedEmployer ? "DIRECT_EMPLOYER" : "UNKNOWN", input.description)
    .filter((role) => ["EXECUTIVE_SPONSOR", "FINANCE_LEADER", "ACCOUNTING_LEADER"].includes(role.classification))
    .slice(0, 4);
  if (!targetRoles.some((role) => /chief financial|cfo/i.test(role.title))) {
    targetRoles.unshift({ title: "Chief Financial Officer", classification: "FINANCE_LEADER", priority: 100, reason: "A VP of Finance commonly reports to the CFO." });
  }
  if (/\bcao|chief accounting officer\b/i.test(input.description) && !targetRoles.some((role) => /chief accounting|cao/i.test(role.title))) {
    targetRoles.push({ title: "Chief Accounting Officer", classification: "ACCOUNTING_LEADER", priority: 92, reason: "The brief names a CAO as an internal partner." });
  }

  for (const candidate of candidates.slice(0, 3)) {
    const search = await providers.people.search({
      organization: { canonicalName: candidate, domain: candidate.includes(".") ? candidate : null, alternateNames: namedEmployer ? [namedEmployer] : [] },
      targetRoles,
      limit: 8
    });
    const resolved = search.resolvedOrganization;
    if (!resolved) continue;

    const contacts = [];
    for (const person of search.people) {
      if (contacts.length >= 2) break;
      if (!person.firstName || !person.lastName) continue;
      const emails = providers.people instanceof ApolloContactProvider
        ? await providers.people.findBusinessEmails({ person, organizationDomain: resolved.domain })
        : { emails: [] };
      contacts.push({
        full_name: person.fullName,
        job_title: person.currentTitle,
        linkedin_url: safeLinkedIn(person.professionalProfileUrl),
        estimated_email: estimateBusinessEmail(person.firstName, person.lastName, resolved.domain, emails.emails[0]?.email ?? null)
      });
    }

    return resumeTargetIntelligenceSchema.parse({
      identified_company: {
        company_name: resolved.canonicalName,
        confidence_score_percentage: Math.min(namedEmployer ? 100 : 72, resolved.confidence),
        matching_clues: clues
      },
      primary_contacts: contacts
    });
  }

  return namedEmployer ? namedEmployerOnly(namedEmployer, clues) : emptyIntelligence(clues);
}
