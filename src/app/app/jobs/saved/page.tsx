import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, BriefcaseBusiness, Building2, CalendarDays, ExternalLink, MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobsAttribution } from "@/components/jobs-attribution";
import { SavedJobActions } from "@/components/saved-job-actions";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatJobPostedDate } from "@/lib/jobs/format";
import { formatMailTimestamp } from "@/lib/mail/date-format";

export const metadata = { title: "Saved Jobs" };

export default async function SavedJobsPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { data: jobs, error } = await owner.database.from("job_opportunities").select("id, title, company_name, location_text, posted_at, source_name, source_url, saved_at").eq("owner_id", owner.user.id).eq("status", "SAVED").order("saved_at", { ascending: false });
  if (error) throw new Error("SAVED_JOBS_UNAVAILABLE");
  const jobIds = (jobs ?? []).map((job) => job.id);
  const { data: associations, error: associationError } = jobIds.length ? await owner.database.from("job_opportunity_projects").select("job_opportunity_id, project_id").eq("owner_id", owner.user.id).in("job_opportunity_id", jobIds) : { data: [], error: null };
  if (associationError) throw new Error("SAVED_JOBS_UNAVAILABLE");
  const projectIds = [...new Set((associations ?? []).map((item) => item.project_id))];
  const { data: projects, error: projectError } = projectIds.length ? await owner.database.from("projects").select("id, name").eq("owner_id", owner.user.id).in("id", projectIds) : { data: [], error: null };
  if (projectError) throw new Error("SAVED_JOBS_UNAVAILABLE");
  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const projectNamesByJob = new Map<string, string[]>();
  for (const association of associations ?? []) projectNamesByJob.set(association.job_opportunity_id, [...(projectNamesByJob.get(association.job_opportunity_id) ?? []), projectNames.get(association.project_id) ?? "Job Search Project"]);

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs"><div className="mx-auto max-w-7xl"><header><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Opportunity library</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Saved Jobs</h1><p className="mt-3 max-w-2xl text-sm leading-7 text-[#64748B]">Real opportunities you chose to retain, with their source and Project context intact.</p></header>
    <nav aria-label="Jobs" className="mt-7 inline-flex rounded-full border border-[#E8E2E3] bg-[#FFFCFB] p-1"><Link href="/app/jobs" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#64748B]"><Search className="size-4" /> Search Jobs</Link><Link href="/app/jobs/saved" aria-current="page" className="inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-2.5 text-sm font-semibold text-white"><Bookmark className="size-4" /> Saved Jobs</Link></nav>
    {!jobs?.length ? <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-10 text-center shadow-[0_14px_42px_rgba(24,58,90,.06)]"><BriefcaseBusiness className="mx-auto size-9 text-[#D95B72]" /><h2 className="mt-4 text-xl font-semibold text-[#183A5A]">No saved opportunities yet</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#64748B]">Search real jobs and save only the opportunities you want to revisit.</p><Link href="/app/jobs" className="mt-5 inline-flex rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white">Search Jobs</Link></section> : <section aria-label="Saved opportunities" className="mt-8 grid min-w-0 gap-5 lg:grid-cols-2">{jobs.map((job) => <article key={job.id} className="flex min-w-0 flex-col rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6"><h2 className="break-words text-lg font-semibold leading-7 text-[#183A5A]">{job.title}</h2><p className="mt-2 flex min-w-0 items-center gap-2 text-sm font-semibold text-[#64748B]"><Building2 className="size-4 shrink-0 text-[#D95B72]" /><span className="truncate">{job.company_name}</span></p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#64748B]"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{job.location_text || "Location not provided"}</span>{formatJobPostedDate(job.posted_at) && <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />Posted {formatJobPostedDate(job.posted_at)}</span>}</div><p className="mt-4 text-xs text-[#64748B]">Saved {formatMailTimestamp(job.saved_at)}</p><div className="mt-4"><p className="text-[10px] font-semibold uppercase tracking-[.1em] text-[#64748B]">Project</p>{projectNamesByJob.get(job.id)?.length ? <div className="mt-2 flex flex-wrap gap-2">{projectNamesByJob.get(job.id)?.map((name) => <span key={name} className="rounded-full bg-[#FFF3F4] px-3 py-1 text-xs font-semibold text-[#A73D52]">{name}</span>)}</div> : <p className="mt-2 text-sm text-[#64748B]">Saved Jobs / No Project</p>}</div><div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-6"><JobsAttribution compact /><div className="flex flex-wrap gap-2"><Link href={`/app/jobs/saved/${job.id}`} className="rounded-full bg-[#183A5A] px-4 py-2 text-xs font-semibold text-white">Open</Link><a href={job.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#183A5A]">View Original <ExternalLink className="size-3.5" /></a></div></div><div className="mt-4 border-t border-[#E8E2E3] pt-4"><SavedJobActions jobId={job.id} /></div></article>)}</section>}
  </div></AppShell>;
}
