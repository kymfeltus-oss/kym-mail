import { z } from "zod";
import type { JobSearchFilters, JobSearchRequest, NormalizedJob } from "@/domain/providers/job-search-provider";
import { ValidationError } from "@/lib/errors";

export const MAX_JOB_QUERY_LENGTH = 200;
export const JOB_RESULTS_PER_PAGE = 20;

const cleanText = (maximum: number) => z.string().transform((value) => value.replace(/\s+/g, " ").trim()).pipe(z.string().max(maximum, `Searches may contain at most ${maximum} characters.`));
const optionalText = (maximum: number) => z.union([z.string(), z.undefined(), z.null()]).transform((value) => String(value ?? "").replace(/\s+/g, " ").trim()).pipe(z.string().max(maximum));
const optionalInteger = z.union([z.string(), z.number(), z.undefined(), z.null()]).transform((value, context) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    context.addIssue({ code: "custom", message: "Enter a valid whole number." });
    return z.NEVER;
  }
  return parsed;
});

export const jobSearchInputSchema = z.object({
  query: cleanText(MAX_JOB_QUERY_LENGTH).refine((value) => value.length > 0, "Enter a job title, keyword, skill, or phrase."),
  location: optionalText(160),
  workArrangement: z.enum(["ANY", "REMOTE", "HYBRID"]).default("ANY"),
  datePostedDays: z.union([z.literal(""), z.literal("1"), z.literal("3"), z.literal("7"), z.literal("14"), z.literal("30"), z.literal(1), z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).optional().nullable(),
  employmentType: z.enum(["ANY", "FULL_TIME", "PART_TIME", "CONTRACT", "PERMANENT"]).default("ANY"),
  minimumSalary: optionalInteger.pipe(z.number().int().max(10_000_000).nullable()),
  page: z.union([z.string(), z.number(), z.undefined()]).transform((value) => value === undefined || value === "" ? 1 : Number(value)).pipe(z.number().int().min(1).max(50))
});

function tokenizeQuery(query: string) {
  const terms: string[] = [];
  let token = "";
  let quoted = false;
  for (const character of query) {
    if (character === '"') {
      if (quoted) {
        if (token.trim()) terms.push(token.replace(/\s+/g, " ").trim());
        token = "";
        quoted = false;
      } else {
        if (token.trim()) terms.push(...token.trim().split(/\s+/));
        token = "";
        quoted = true;
      }
      continue;
    }
    if (!quoted && /\s/.test(character)) {
      if (token.trim()) terms.push(token.trim());
      token = "";
    } else token += character;
  }
  if (quoted) throw new ValidationError("Close the quoted search phrase before searching.");
  if (token.trim()) terms.push(...(quoted ? [token.trim()] : token.trim().split(/\s+/)));
  return terms;
}

export function normalizeJobQuery(query: string) {
  const originalQuery = query.replace(/\s+/g, " ").trim();
  if (!originalQuery) throw new ValidationError("Enter a job title, keyword, skill, or phrase.");
  if (originalQuery.length > MAX_JOB_QUERY_LENGTH) throw new ValidationError(`Searches may contain at most ${MAX_JOB_QUERY_LENGTH} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(originalQuery)) throw new ValidationError("The search contains unsupported characters.");
  const seen = new Set<string>();
  const normalizedTerms = tokenizeQuery(originalQuery).filter((term) => {
    const key = term.toLocaleLowerCase("en-US");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!normalizedTerms.length) throw new ValidationError("Enter a job title, keyword, skill, or phrase.");
  return { originalQuery, normalizedQuery: normalizedTerms.join(" "), normalizedTerms };
}

export function parseJobSearchInput(input: unknown): JobSearchRequest {
  const parsed = jobSearchInputSchema.parse(input);
  const query = normalizeJobQuery(parsed.query);
  const days = parsed.datePostedDays === "" || parsed.datePostedDays === undefined || parsed.datePostedDays === null
    ? null
    : Number(parsed.datePostedDays) as JobSearchFilters["datePostedDays"];
  return {
    ...query,
    filters: {
      location: parsed.location,
      workArrangement: parsed.workArrangement,
      datePostedDays: days,
      employmentType: parsed.employmentType,
      minimumSalary: parsed.minimumSalary
    },
    page: parsed.page,
    pageSize: JOB_RESULTS_PER_PAGE
  };
}

function canonicalSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((key) => url.searchParams.delete(key));
    return url.toString().toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

function fallbackFingerprint(job: NormalizedJob) {
  const normalize = (value: string | null) => String(value ?? "").replace(/[^a-z0-9]+/gi, " ").trim().toLocaleLowerCase("en-US");
  return [normalize(job.companyName), normalize(job.title), normalize(job.locationText)].join("|");
}

export function deduplicateJobs(jobs: NormalizedJob[]) {
  const providerIds = new Set<string>();
  const sourceUrls = new Set<string>();
  const fingerprints = new Set<string>();
  return jobs.filter((job) => {
    const providerKey = `${job.provider}:${job.providerJobId}`;
    const sourceKey = canonicalSourceUrl(job.sourceUrl);
    const fingerprint = fallbackFingerprint(job);
    if (providerIds.has(providerKey) || (sourceKey && sourceUrls.has(sourceKey)) || (!sourceKey && fingerprints.has(fingerprint))) return false;
    providerIds.add(providerKey);
    if (sourceKey) sourceUrls.add(sourceKey);
    else fingerprints.add(fingerprint);
    return true;
  });
}

export function applySearchRelevance(job: NormalizedJob, terms: string[]): NormalizedJob {
  const title = job.title.toLocaleLowerCase("en-US");
  const description = job.descriptionText.toLocaleLowerCase("en-US");
  const matchedTitleTerms = terms.filter((term) => title.includes(term.toLocaleLowerCase("en-US")));
  const matchedDescriptionTerms = terms.filter((term) => !matchedTitleTerms.includes(term) && description.includes(term.toLocaleLowerCase("en-US")));
  return {
    ...job,
    matchedTitleTerms,
    matchedDescriptionTerms,
    strongKeywordMatch: matchedTitleTerms.some((term) => term.includes(" ")) || matchedTitleTerms.length >= Math.min(2, terms.length)
  };
}

export function buildProjectSearchDefaults(parameters: Record<string, unknown>) {
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  const targetRoles = strings(parameters.targetRoles);
  const keywords = strings(parameters.keywords);
  const arrangements = strings(parameters.arrangements);
  return {
    query: [...targetRoles.slice(0, 2), ...keywords.slice(0, 4)].join(" "),
    location: typeof parameters.locationText === "string" ? parameters.locationText : "",
    workArrangement: arrangements.includes("REMOTE") ? "REMOTE" as const : arrangements.includes("HYBRID") ? "HYBRID" as const : "ANY" as const,
    minimumSalary: typeof parameters.minimumCompensation === "number" ? String(parameters.minimumCompensation) : ""
  };
}
