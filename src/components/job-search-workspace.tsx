"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Bookmark, BriefcaseBusiness, Building2, CalendarDays, Check, ExternalLink, LoaderCircle, MapPin, Search, SlidersHorizontal, WalletCards, X } from "lucide-react";
import type { JobSearchRequest, JobSearchResponse, NormalizedJob } from "@/domain/providers/job-search-provider";
import { JobsAttribution } from "@/components/jobs-attribution";
import { employmentTypeLabels, formatJobPostedDate, formatJobSalary, workArrangementLabels } from "@/lib/jobs/format";

type SearchJob = NormalizedJob & { isSaved: boolean; savedJobId: string | null };
type SearchResponse = { request: JobSearchRequest; result: Omit<JobSearchResponse, "jobs"> & { jobs: SearchJob[] } };
type ProjectOption = { id: string; name: string };
type Defaults = { query: string; location: string; workArrangement: "ANY" | "REMOTE" | "HYBRID"; minimumSalary: string };

function inputClass() { return "w-full rounded-2xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 text-sm text-[#183A5A] outline-none transition placeholder:text-[#94A3B8] focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]"; }

export function JobSearchWorkspace({ projects, defaults, initialProjectId }: { projects: ProjectOption[]; defaults: Defaults; initialProjectId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ ...defaults, datePostedDays: "", employmentType: "ANY", page: "1" });
  const [activeInput, setActiveInput] = useState<typeof form | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [selectedJob, setSelectedJob] = useState<SearchJob | null>(null);
  const [saveProjectId, setSaveProjectId] = useState(initialProjectId);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function executeSearch(input: typeof form) {
    setLoading(true); setError(""); setNotice("");
    const parameters = new URLSearchParams({ query: input.query, location: input.location, workArrangement: input.workArrangement, datePostedDays: input.datePostedDays, employmentType: input.employmentType, minimumSalary: input.minimumSalary, page: input.page });
    try {
      const result = await fetch(`/api/jobs/search?${parameters}`, { headers: { accept: "application/json" }, cache: "no-store" });
      const payload = await result.json() as SearchResponse & { error?: string };
      if (!result.ok) throw new Error(payload.error || "Job Search could not be completed.");
      setResponse(payload); setActiveInput(input); setSelectedJob(null); setForm(input);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Job Search could not be completed."); }
    finally { setLoading(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void executeSearch({ ...form, page: "1" }); }
  function changePage(page: number) { if (!activeInput) return; void executeSearch({ ...activeInput, page: String(page) }); }

  async function saveJob(job: SearchJob) {
    if (!activeInput) return;
    setSavingId(job.providerJobId); setError(""); setNotice("");
    try {
      const result = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ providerJobId: job.providerJobId, projectId: saveProjectId || null, search: { query: activeInput.query, location: activeInput.location, workArrangement: activeInput.workArrangement, datePostedDays: activeInput.datePostedDays, employmentType: activeInput.employmentType, minimumSalary: activeInput.minimumSalary, page: activeInput.page } }) });
      const payload = await result.json() as { jobId?: string; error?: string };
      if (!result.ok || !payload.jobId) throw new Error(payload.error || "The job could not be saved.");
      setResponse((current) => current ? { ...current, result: { ...current.result, jobs: current.result.jobs.map((item) => item.providerJobId === job.providerJobId ? { ...item, isSaved: true, savedJobId: payload.jobId ?? null } : item) } } : current);
      setSelectedJob((current) => current?.providerJobId === job.providerJobId ? { ...current, isSaved: true, savedJobId: payload.jobId ?? null } : current);
      setNotice(saveProjectId ? "Job saved to the selected Project." : "Job saved without a Project.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The job could not be saved."); }
    finally { setSavingId(null); }
  }

  const jobs = response?.result.jobs ?? [];
  return <div className="mt-8 min-w-0">
    <form onSubmit={submit} className="rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-7">
      <label htmlFor="job-query" className="text-sm font-semibold text-[#183A5A]">Job title, keywords, skills, or phrases</label>
      <div className="mt-2 flex flex-col gap-3 lg:flex-row"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#D95B72]" /><input id="job-query" required maxLength={200} value={form.query} onChange={(event) => setForm({ ...form, query: event.target.value })} placeholder="Finance Systems Workday automation" className={`${inputClass()} pl-12`} /></div><button disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-[#D95B72] px-7 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(217,91,114,.22)] disabled:cursor-wait disabled:opacity-60">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Search className="size-4" />}{loading ? "Searching…" : "Search Jobs"}</button></div>
      <div className="mt-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]"><SlidersHorizontal className="size-4 text-[#D95B72]" /> Supported filters</div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="text-xs font-semibold text-[#64748B]">Location<input value={form.location} maxLength={160} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Dallas, TX" className={`${inputClass()} mt-2`} /></label>
        <label className="text-xs font-semibold text-[#64748B]">Work arrangement<select value={form.workArrangement} onChange={(event) => setForm({ ...form, workArrangement: event.target.value as typeof form.workArrangement })} className={`${inputClass()} mt-2`}><option value="ANY">Any</option><option value="REMOTE">Remote</option><option value="HYBRID">Hybrid</option></select></label>
        <label className="text-xs font-semibold text-[#64748B]">Date posted<select value={form.datePostedDays} onChange={(event) => setForm({ ...form, datePostedDays: event.target.value })} className={`${inputClass()} mt-2`}><option value="">Any time</option><option value="1">Past 24 hours</option><option value="3">Past 3 days</option><option value="7">Past 7 days</option><option value="14">Past 14 days</option><option value="30">Past 30 days</option></select></label>
        <label className="text-xs font-semibold text-[#64748B]">Employment<select value={form.employmentType} onChange={(event) => setForm({ ...form, employmentType: event.target.value })} className={`${inputClass()} mt-2`}><option value="ANY">Any</option><option value="FULL_TIME">Full time</option><option value="PART_TIME">Part time</option><option value="CONTRACT">Contract</option><option value="PERMANENT">Permanent</option></select></label>
        <label className="text-xs font-semibold text-[#64748B]">Minimum salary<input type="number" inputMode="numeric" min="1" max="10000000" value={form.minimumSalary} onChange={(event) => setForm({ ...form, minimumSalary: event.target.value })} placeholder="175000" className={`${inputClass()} mt-2`} /></label>
      </div>
      <p className="mt-4 text-xs leading-5 text-[#64748B]">Filters are sent to Adzuna. Remote and Hybrid refine the provider keyword query. Salary data is shown only when the listing supplies it.</p>
    </form>

    {error && <div role="alert" className="mt-5 flex items-start gap-3 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] p-4 text-sm text-[#A73D52]"><X className="mt-0.5 size-4 shrink-0" /><span>{error}</span></div>}
    {notice && <div role="status" className="mt-5 flex items-center gap-3 rounded-2xl border border-[#C9E1D2] bg-[#F3FBF6] p-4 text-sm font-semibold text-[#23623E]"><Check className="size-4" />{notice}</div>}
    {loading && <div aria-live="polite" className="mt-8 grid gap-4 lg:grid-cols-2">{[0,1,2,3].map((item) => <div key={item} className="h-64 animate-pulse rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB]" />)}</div>}

    {!loading && response && <section aria-labelledby="job-results-title" className="mt-9">
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Real provider results</p><h2 id="job-results-title" className="mt-1 text-2xl font-semibold text-[#183A5A]">{response.result.total.toLocaleString()} opportunities found</h2><p className="mt-2 text-sm text-[#64748B]">Showing normalized, deduplicated listings from Adzuna.</p></div><JobsAttribution /></div>
      {!jobs.length ? <div className="mt-6 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-8 text-center"><BriefcaseBusiness className="mx-auto size-8 text-[#D95B72]" /><h3 className="mt-4 text-lg font-semibold text-[#183A5A]">No jobs matched this search</h3><p className="mt-2 text-sm leading-6 text-[#64748B]">Try broader keywords, a wider location, or fewer filters. KYM Mail will never fill this state with fabricated listings.</p></div> : <div className="mt-6 grid min-w-0 gap-5 lg:grid-cols-2">{jobs.map((job) => {
        const salary = formatJobSalary(job); const posted = formatJobPostedDate(job.postedAt);
        return <article key={`${job.provider}:${job.providerJobId}`} className="flex min-w-0 flex-col rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6"><div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><h3 className="break-words text-lg font-semibold leading-7 text-[#183A5A]">{job.title}</h3><p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#64748B]"><Building2 className="size-4 shrink-0 text-[#D95B72]" /><span className="truncate">{job.companyName}</span></p></div>{job.isSaved && <span className="shrink-0 rounded-full bg-[#F7DDE1] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.1em] text-[#A73D52]">Saved</span>}</div>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64748B]"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{job.locationText || "Location not provided"}</span>{job.workArrangement !== "UNKNOWN" && <span>{workArrangementLabels[job.workArrangement]}</span>}{posted && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />Posted {posted}</span>}{salary && <span className="inline-flex items-center gap-1.5"><WalletCards className="size-3.5" />{salary}</span>}</div>
          {job.employmentTypes.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{job.employmentTypes.map((type) => <span key={type} className="rounded-full bg-[#FFF3F4] px-2.5 py-1 text-[10px] font-semibold text-[#A73D52]">{employmentTypeLabels[type]}</span>)}</div>}
          {job.strongKeywordMatch && <p className="mt-4 text-xs font-semibold text-[#A73D52]">Strong keyword match</p>}
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#64748B]">{job.descriptionText || "The provider did not supply a description preview."}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6"><JobsAttribution compact /><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSelectedJob(job); document.getElementById("job-detail")?.scrollIntoView({ behavior: "smooth" }); }} className="rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#183A5A]">View Job</button><button type="button" disabled={job.isSaved || savingId === job.providerJobId} onClick={() => void saveJob(job)} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-4 py-2 text-xs font-semibold text-white disabled:bg-[#D7A6AF]">{savingId === job.providerJobId ? <LoaderCircle className="size-3.5 animate-spin" /> : <Bookmark className="size-3.5" />}{job.isSaved ? "Saved" : "Save"}</button></div></div>
        </article>;
      })}</div>}
      <nav aria-label="Job results pages" className="mt-7 flex items-center justify-center gap-3"><button type="button" disabled={response.result.page <= 1} onClick={() => changePage(response.result.page - 1)} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-2 text-sm font-semibold text-[#183A5A] disabled:opacity-40"><ArrowLeft className="size-4" /> Previous</button><span className="text-sm text-[#64748B]">Page {response.result.page}</span><button type="button" disabled={!response.result.hasNextPage} onClick={() => changePage(response.result.page + 1)} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-2 text-sm font-semibold text-[#183A5A] disabled:opacity-40">Next <ArrowRight className="size-4" /></button></nav>
    </section>}

    {selectedJob && <section id="job-detail" tabIndex={-1} aria-labelledby="job-detail-title" className="mt-10 scroll-mt-8 rounded-[2rem] border border-[#E7B8C1] bg-[#FFFCFB] p-5 shadow-[0_24px_70px_rgba(24,58,90,.1)] sm:p-8"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Job detail</p><h2 id="job-detail-title" className="mt-2 break-words text-2xl font-semibold text-[#183A5A] sm:text-3xl">{selectedJob.title}</h2><p className="mt-2 text-base font-semibold text-[#64748B]">{selectedJob.companyName}</p></div><button type="button" onClick={() => setSelectedJob(null)} aria-label="Close job detail" className="rounded-full border border-[#E8E2E3] p-2 text-[#64748B]"><X className="size-4" /></button></div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[#64748B]">Location</dt><dd className="mt-2 text-sm text-[#183A5A]">{selectedJob.locationText || "Not provided"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[#64748B]">Work arrangement</dt><dd className="mt-2 text-sm text-[#183A5A]">{workArrangementLabels[selectedJob.workArrangement]}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[#64748B]">Compensation</dt><dd className="mt-2 text-sm text-[#183A5A]">{formatJobSalary(selectedJob) || "Not provided"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.1em] text-[#64748B]">Posted</dt><dd className="mt-2 text-sm text-[#183A5A]">{formatJobPostedDate(selectedJob.postedAt) || "Not provided"}</dd></div></dl>
      {(selectedJob.matchedTitleTerms.length > 0 || selectedJob.matchedDescriptionTerms.length > 0) && <div className="mt-6 rounded-2xl bg-[#FFF3F4] p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#A73D52]">Why this result</p><div className="mt-3 flex flex-wrap gap-2">{[...selectedJob.matchedTitleTerms, ...selectedJob.matchedDescriptionTerms].map((term) => <span key={term} className="rounded-full border border-[#E7B8C1] bg-[#FFFCFB] px-3 py-1 text-xs font-semibold text-[#183A5A]">{term}</span>)}</div></div>}
      <div className="mt-7"><h3 className="text-lg font-semibold text-[#183A5A]">Available description</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-[#465B70]">{selectedJob.descriptionText || "The provider did not supply a description preview. View the original posting for complete details."}</p></div>
      <div className="mt-8 flex flex-col gap-4 border-t border-[#E8E2E3] pt-6 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><JobsAttribution /><p className="mt-2 text-xs text-[#64748B]">The original source remains authoritative for availability and application details.</p></div><div className="flex flex-col gap-3 sm:items-end"><a href={selectedJob.applicationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#E8E2E3] px-5 py-3 text-sm font-semibold text-[#183A5A]">View Original Posting <ExternalLink className="size-4" /></a><div className="flex flex-col gap-2 sm:flex-row"><select aria-label="Project for saved job" value={saveProjectId} onChange={(event) => setSaveProjectId(event.target.value)} className="rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 text-sm text-[#183A5A]"><option value="">Saved Jobs / No Project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button type="button" disabled={selectedJob.isSaved || savingId === selectedJob.providerJobId} onClick={() => void saveJob(selectedJob)} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white disabled:bg-[#D7A6AF]">{savingId === selectedJob.providerJobId ? <LoaderCircle className="size-4 animate-spin" /> : <Bookmark className="size-4" />}{selectedJob.isSaved ? "Saved" : "Save Job"}</button></div></div></div>
    </section>}
  </div>;
}
