import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { EmploymentType, JobSearchProvider, JobSearchRequest, JobSearchResponse, NormalizedJob, WorkArrangement } from "@/domain/providers/job-search-provider";
import { ConfigurationError, ProviderUnavailableError } from "@/lib/errors";
import { applySearchRelevance, deduplicateJobs } from "@/lib/jobs/search";

type AdzunaCredentials = { ADZUNA_APP_ID: string; ADZUNA_APP_KEY: string };
type FetchLike = typeof fetch;

const adSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  description: z.string().optional().default(""),
  redirect_url: z.string(),
  created: z.string().optional(),
  company: z.object({ display_name: z.string().optional() }).passthrough().optional(),
  location: z.object({ display_name: z.string().optional() }).passthrough().optional(),
  category: z.object({ tag: z.string().optional(), label: z.string().optional() }).passthrough().optional(),
  source: z.object({ display_name: z.string().optional() }).passthrough().optional(),
  contract_time: z.string().optional(),
  contract_type: z.string().optional(),
  salary_min: z.number().finite().nonnegative().optional(),
  salary_max: z.number().finite().nonnegative().optional(),
  // The live U.S. API serializes this flag as "0"/"1" even though some
  // documented/sample responses use numbers or booleans.
  salary_is_predicted: z.union([z.number(), z.boolean(), z.string()]).optional()
}).passthrough();
const responseSchema = z.object({ count: z.number().int().nonnegative().optional().default(0), results: z.array(z.unknown()).default([]) }).passthrough();

function decodeTextEntities(value: string) {
  const named: Record<string, string> = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi, (entity, body: string) => {
    const lower = body.toLocaleLowerCase("en-US");
    if (lower in named) return named[lower];
    const codePoint = lower.startsWith("#x") ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10);
    return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : entity;
  });
}

function cleanPlainText(value: string, maximum: number) {
  return decodeTextEntities(sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, " ").trim().slice(0, maximum);
}

function safeAdzunaUrl(value: string) {
  try {
    const url = new URL(value);
    const isAdzunaHost = url.hostname === "adzuna.com" || url.hostname.endsWith(".adzuna.com");
    if (url.protocol === "http:" && isAdzunaHost) url.protocol = "https:";
    if (url.protocol !== "https:" || !isAdzunaHost) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeEmploymentTypes(contractTime?: string, contractType?: string): EmploymentType[] {
  const values = new Set<EmploymentType>();
  if (contractTime === "full_time") values.add("FULL_TIME");
  if (contractTime === "part_time") values.add("PART_TIME");
  if (contractType === "contract") values.add("CONTRACT");
  if (contractType === "permanent") values.add("PERMANENT");
  return [...values];
}

function inferWorkArrangement(title: string, description: string, location: string | null): WorkArrangement {
  const text = `${title} ${description} ${location ?? ""}`.toLocaleLowerCase("en-US");
  if (/\b(remote|work from home|telecommut(?:e|ing))\b/.test(text)) return "REMOTE";
  if (/\bhybrid\b/.test(text)) return "HYBRID";
  return "UNKNOWN";
}

function validDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeAdzunaRecord(value: unknown, now = new Date()): NormalizedJob | null {
  const parsed = adSchema.safeParse(value);
  if (!parsed.success) return null;
  const ad = parsed.data;
  const title = cleanPlainText(ad.title, 300);
  const descriptionText = cleanPlainText(ad.description, 30_000);
  const companyName = cleanPlainText(ad.company?.display_name ?? "", 200);
  const locationText = cleanPlainText(ad.location?.display_name ?? "", 300) || null;
  const sourceUrl = safeAdzunaUrl(ad.redirect_url);
  if (!title || !companyName || !sourceUrl) return null;
  const salaryIsPredicted = ad.salary_is_predicted === true
    || ad.salary_is_predicted === 1
    || ad.salary_is_predicted === "1"
    || ad.salary_is_predicted === "true";
  const salaryMinimum = !salaryIsPredicted && typeof ad.salary_min === "number" ? Math.round(ad.salary_min) : null;
  const salaryMaximum = !salaryIsPredicted && typeof ad.salary_max === "number" ? Math.round(ad.salary_max) : null;
  return {
    provider: "ADZUNA",
    providerJobId: String(ad.id).trim(),
    title,
    companyName,
    companyIdentifier: null,
    locationText,
    workArrangement: inferWorkArrangement(title, descriptionText, locationText),
    employmentTypes: normalizeEmploymentTypes(ad.contract_time, ad.contract_type),
    salaryMinimum,
    salaryMaximum,
    salaryCurrency: salaryMinimum !== null || salaryMaximum !== null ? "USD" : null,
    salaryPeriod: salaryMinimum !== null || salaryMaximum !== null ? "YEAR" : null,
    descriptionText,
    postedAt: validDate(ad.created),
    sourceName: "Adzuna",
    sourceUrl,
    applicationUrl: sourceUrl,
    discoveredAt: now.toISOString(),
    providerMetadata: {
      categoryTag: cleanPlainText(ad.category?.tag ?? "", 100) || null,
      categoryLabel: cleanPlainText(ad.category?.label ?? "", 160) || null,
      providerSource: cleanPlainText(ad.source?.display_name ?? "", 160) || null,
      salaryIsPredicted
    },
    matchedTitleTerms: [],
    matchedDescriptionTerms: [],
    strongKeywordMatch: false
  };
}

export class AdzunaJobSearchProvider implements JobSearchProvider {
  readonly providerName = "ADZUNA" as const;

  constructor(private readonly credentials: AdzunaCredentials, private readonly fetcher: FetchLike = fetch) {
    if (!credentials.ADZUNA_APP_ID || !credentials.ADZUNA_APP_KEY) throw new ConfigurationError("Job Search is not configured.");
  }

  async search(request: JobSearchRequest): Promise<JobSearchResponse> {
    const url = new URL(`https://api.adzuna.com/v1/api/jobs/us/search/${request.page}`);
    url.searchParams.set("app_id", this.credentials.ADZUNA_APP_ID);
    url.searchParams.set("app_key", this.credentials.ADZUNA_APP_KEY);
    url.searchParams.set("results_per_page", String(request.pageSize));
    const requestedWorkTerm = request.filters.workArrangement === "ANY" ? "" : request.filters.workArrangement.toLocaleLowerCase("en-US");
    const workTerm = request.normalizedTerms.some((term) => term.toLocaleLowerCase("en-US") === requestedWorkTerm) ? "" : requestedWorkTerm;
    url.searchParams.set("what", [request.normalizedQuery, workTerm].filter(Boolean).join(" "));
    url.searchParams.set("content-type", "application/json");
    if (request.filters.location) url.searchParams.set("where", request.filters.location);
    if (request.filters.datePostedDays) url.searchParams.set("max_days_old", String(request.filters.datePostedDays));
    if (request.filters.minimumSalary) url.searchParams.set("salary_min", String(request.filters.minimumSalary));
    if (request.filters.employmentType !== "ANY") {
      const parameter = { FULL_TIME: "full_time", PART_TIME: "part_time", CONTRACT: "contract", PERMANENT: "permanent" }[request.filters.employmentType];
      url.searchParams.set(parameter, "1");
    }

    let response: Response;
    try {
      response = await this.fetcher(url, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch (error) {
      throw new ProviderUnavailableError("Job Search is temporarily unavailable. Please try again.", { reason: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network" });
    }
    if (response.status === 401 || response.status === 403) throw new ConfigurationError("Job Search provider credentials need attention.");
    if (response.status === 429) throw new ProviderUnavailableError("Job Search has reached its provider limit. Please try again later.", { reason: "rate_limit" });
    if (!response.ok) throw new ProviderUnavailableError("Job Search is temporarily unavailable. Please try again.", { status: response.status });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ProviderUnavailableError("Job Search returned an unreadable response.", { reason: "malformed_json" });
    }
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new ProviderUnavailableError("Job Search returned an unexpected response.", { reason: "malformed_response" });
    const normalized = parsed.data.results.map((item) => normalizeAdzunaRecord(item)).filter((item): item is NormalizedJob => Boolean(item));
    if (parsed.data.results.length > 0 && normalized.length === 0) throw new ProviderUnavailableError("Job Search returned incomplete listings. Please try again.", { reason: "no_valid_records" });
    const jobs = deduplicateJobs(normalized).map((job) => applySearchRelevance(job, request.normalizedTerms));
    return { jobs, total: parsed.data.count, page: request.page, pageSize: request.pageSize, hasNextPage: request.page * request.pageSize < parsed.data.count, sourceName: "Adzuna" };
  }
}
