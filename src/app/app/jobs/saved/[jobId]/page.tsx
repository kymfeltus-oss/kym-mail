import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, ExternalLink, MapPin, Users, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobAnalysisPanel } from "@/components/job-analysis-panel";
import { JobDescriptionEditor } from "@/components/job-description-editor";
import { JobsAttribution } from "@/components/jobs-attribution";
import { JobProjectManager, SavedJobActions } from "@/components/saved-job-actions";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadCareerEvidence } from "@/lib/jobs/career-evidence";
import { employmentTypeLabels, formatJobPostedDate, formatJobSalary, workArrangementLabels } from "@/lib/jobs/format";
import { loadJobAnalysisView, markAnalysisStaleIfNeeded, recoverStuckAnalysis } from "@/lib/jobs/analysis-store";
import type { EmploymentType, WorkArrangement } from "@/domain/providers/job-search-provider";

export const metadata = { title: "Saved Job" };

export default async function SavedJobPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ project?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { jobId } = await params;
  const { project: projectId } = await searchParams;
  const { data: job, error } = await owner.database.from("job_opportunities").select("id, title, company_name, location_text, work_arrangement, employment_types, salary_minimum, salary_maximum, salary_currency, salary_period, description_text, posted_at, source_name, source_url, application_url, provider_metadata, saved_at, status").eq("id", jobId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("SAVED_JOB_UNAVAILABLE");
  if (!job || job.status !== "SAVED") notFound();
  const [{ data: projects, error: projectsError }, { data: associations, error: associationsError }] = await Promise.all([
    owner.database.from("projects").select("id, name").eq("owner_id", owner.user.id).eq("type", "JOB_SEARCH").eq("status", "ACTIVE").order("updated_at", { ascending: false }),
    owner.database.from("job_opportunity_projects").select("project_id").eq("owner_id", owner.user.id).eq("job_opportunity_id", job.id)
  ]);
  if (projectsError || associationsError) throw new Error("SAVED_JOB_UNAVAILABLE");
  const salary = formatJobSalary({ salaryMinimum: job.salary_minimum, salaryMaximum: job.salary_maximum, salaryCurrency: job.salary_currency, salaryPeriod: job.salary_period });
  const workArrangement = job.work_arrangement as WorkArrangement;
  const employment = (job.employment_types ?? []) as EmploymentType[];
  let analysis = await loadJobAnalysisView(owner.database, owner.user.id, job.id);
  if (analysis) analysis = await recoverStuckAnalysis(owner.database, owner.user.id, analysis);
  if (analysis?.status === "COMPLETE") {
    try {
      const careerEvidence = await loadCareerEvidence(owner.database, owner.user.id);
      analysis = await markAnalysisStaleIfNeeded(owner.database, owner.user.id, analysis, job.description_text ?? "", careerEvidence);
    } catch {
      analysis = await markAnalysisStaleIfNeeded(owner.database, owner.user.id, analysis, job.description_text ?? "");
    }
  }

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs"><article className="mx-auto max-w-5xl"><Link href="/app/jobs/saved" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> Saved Jobs</Link><header className="mt-6 rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Saved opportunity</p><h1 className="mt-3 break-words text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">{job.title}</h1><p className="mt-3 flex items-center gap-2 text-base font-semibold text-[#64748B]"><Building2 className="size-5 text-[#D95B72]" />{job.company_name}</p><div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-[#64748B]"><span className="inline-flex items-center gap-2"><MapPin className="size-4" />{job.location_text || "Location not provided"}</span>{salary && <span className="inline-flex items-center gap-2"><WalletCards className="size-4" />{salary}</span>}{formatJobPostedDate(job.posted_at) && <span className="inline-flex items-center gap-2"><CalendarDays className="size-4" />Posted {formatJobPostedDate(job.posted_at)}</span>}</div><div className="mt-4 flex flex-wrap gap-2">{workArrangement !== "UNKNOWN" && <span className="rounded-full bg-[#FFF3F4] px-3 py-1 text-xs font-semibold text-[#A73D52]">{workArrangementLabels[workArrangement]}</span>}{employment.map((type) => <span key={type} className="rounded-full bg-[#FFF3F4] px-3 py-1 text-xs font-semibold text-[#A73D52]">{employmentTypeLabels[type]}</span>)}</div><div className="mt-7 flex flex-wrap items-center justify-between gap-4"><JobsAttribution /><a href={job.application_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white">View Original Posting <ExternalLink className="size-4" /></a></div></header>
    <JobAnalysisPanel jobId={job.id} analysis={analysis} projectId={projectId ?? null} />
    <section className="mt-7 flex flex-col gap-4 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Gate 8</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Hiring intelligence</h2><p className="mt-2 text-sm leading-6 text-[#64748B]">Research and approve a source-backed relevant person. No email discovery or outreach occurs here.</p></div><Link href={`/app/jobs/saved/${job.id}/contacts${projectId ? `?project=${projectId}` : ""}`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white"><Users className="size-4" /> Find Relevant Contact</Link></section>
    <section className="mt-7 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7"><h2 className="text-xl font-semibold text-[#183A5A]">Available description</h2><p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#465B70]">{job.description_text || "The provider did not supply a description preview. View the original posting for complete details."}</p><p className="mt-5 text-xs leading-5 text-[#64748B]">Adzuna supplies a description preview through its standard API. The original posting is authoritative and may contain additional details.</p><JobDescriptionEditor jobId={job.id} description={job.description_text ?? ""} /></section>
    <section className="mt-7 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7"><h2 className="text-xl font-semibold text-[#183A5A]">Job Search Projects</h2><p className="mt-2 text-sm leading-6 text-[#64748B]">Associate this single opportunity with any active Job Search Projects that need its context.</p><JobProjectManager jobId={job.id} projects={projects ?? []} selectedProjectIds={(associations ?? []).map((item) => item.project_id)} /></section>
    <div className="mt-7"><SavedJobActions jobId={job.id} redirectAfter /></div></article></AppShell>;
}
