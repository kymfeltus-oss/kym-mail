import { describe, expect, it, vi } from "vitest";
import { AdzunaJobSearchProvider, normalizeAdzunaRecord } from "@/integrations/adzuna/adzuna-job-search-provider";
import { parseJobSearchInput } from "@/lib/jobs/search";

const credentials = { ADZUNA_APP_ID: "app-id", ADZUNA_APP_KEY: "secret-key" };
const request = parseJobSearchInput({ query: "Finance Systems", location: "Dallas", workArrangement: "REMOTE", datePostedDays: "7", employmentType: "FULL_TIME", minimumSalary: "175000", page: "1" });

function record(overrides: Record<string, unknown> = {}) {
  return { id: "123", title: "<b>Director, Finance Systems</b>", company: { display_name: "Example Corp" }, location: { display_name: "Dallas, Texas" }, description: "Lead <script>alert(1)</script> Workday automation.", redirect_url: "https://www.adzuna.com/details/123?utm_source=api", created: "2026-08-23T12:00:00Z", contract_time: "full_time", contract_type: "permanent", salary_min: 175000, salary_max: 200000, ...overrides };
}

describe("Adzuna adapter", () => {
  it("normalizes safe provider data and strips unsafe description HTML", () => {
    const result = normalizeAdzunaRecord(record(), new Date("2026-08-24T00:00:00Z"));
    expect(result?.title).toBe("Director, Finance Systems");
    expect(result?.descriptionText).toBe("Lead Workday automation.");
    expect(result?.employmentTypes).toEqual(["FULL_TIME", "PERMANENT"]);
    expect(result?.salaryMinimum).toBe(175000);
  });

  it("decodes safe text entities after stripping provider HTML", () => {
    const result = normalizeAdzunaRecord(record({ title: "Director of Finance &amp; Accounting" }));
    expect(result?.title).toBe("Director of Finance & Accounting");
  });

  it("rejects malformed records and unsafe external URLs", () => {
    expect(normalizeAdzunaRecord({ title: "Missing fields" })).toBeNull();
    expect(normalizeAdzunaRecord(record({ redirect_url: "javascript:alert(1)" }))).toBeNull();
    expect(normalizeAdzunaRecord(record({ redirect_url: "https://evil.example/jobs/123" }))).toBeNull();
    expect(normalizeAdzunaRecord(record({ redirect_url: "https://adzuna.com.evil.example/jobs/123" }))).toBeNull();
  });

  it("does not present provider-predicted salary as listing compensation", () => {
    const result = normalizeAdzunaRecord(record({ salary_is_predicted: 1 }));
    expect(result?.salaryMinimum).toBeNull();
    expect(result?.salaryMaximum).toBeNull();
    expect(result?.providerMetadata.salaryIsPredicted).toBe(true);
  });

  it("accepts the live API string representation of the predicted-salary flag", () => {
    const result = normalizeAdzunaRecord(record({ salary_is_predicted: "1" }));
    expect(result?.salaryMinimum).toBeNull();
    expect(result?.salaryMaximum).toBeNull();
    expect(result?.providerMetadata.salaryIsPredicted).toBe(true);
  });

  it("keeps missing optional location, salary, and date truthful", () => {
    const result = normalizeAdzunaRecord(record({ location: undefined, salary_min: undefined, salary_max: undefined, created: undefined }));
    expect(result?.locationText).toBeNull();
    expect(result?.salaryMinimum).toBeNull();
    expect(result?.postedAt).toBeNull();
  });

  it("maps filters into a server-only provider request", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBeDefined();
      return new Response(JSON.stringify({ count: 1, results: [record()] }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const provider = new AdzunaJobSearchProvider(credentials, fetcher as typeof fetch);
    const response = await provider.search(request);
    const requested = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(requested.searchParams.get("what")).toBe("Finance Systems remote");
    expect(requested.searchParams.get("where")).toBe("Dallas");
    expect(requested.searchParams.get("max_days_old")).toBe("7");
    expect(requested.searchParams.get("salary_min")).toBe("175000");
    expect(requested.searchParams.get("full_time")).toBe("1");
    expect(response.jobs).toHaveLength(1);
  });

  it("returns truthful empty results and maps rate limiting safely", async () => {
    const empty = new AdzunaJobSearchProvider(credentials, vi.fn(async () => new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 })) as typeof fetch);
    expect((await empty.search(request)).jobs).toEqual([]);
    const limited = new AdzunaJobSearchProvider(credentials, vi.fn(async () => new Response("limited", { status: 429 })) as typeof fetch);
    await expect(limited.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("maps invalid credentials, timeouts, and unreadable JSON to safe domain errors", async () => {
    const unauthorized = new AdzunaJobSearchProvider(credentials, vi.fn(async () => new Response("unauthorized", { status: 401 })) as typeof fetch);
    await expect(unauthorized.search(request)).rejects.toMatchObject({ code: "CONFIGURATION" });

    const timeout = new AdzunaJobSearchProvider(credentials, vi.fn(async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    }) as typeof fetch);
    await expect(timeout.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });

    const unreadable = new AdzunaJobSearchProvider(credentials, vi.fn(async () => new Response("{", { status: 200 })) as typeof fetch);
    await expect(unreadable.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });

  it("fails safely when every provider record is malformed", async () => {
    const provider = new AdzunaJobSearchProvider(credentials, vi.fn(async () => new Response(JSON.stringify({ count: 1, results: [{ id: "bad" }] }), { status: 200 })) as typeof fetch);
    await expect(provider.search(request)).rejects.toMatchObject({ code: "PROVIDER_UNAVAILABLE" });
  });
});
