import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResumeStudio } from "@/components/resume-studio";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadResumeView } from "@/lib/resumes/store";

export const metadata = { title: "Tailored Resume" };

export default async function TailoredResumePage({ params }: { params: Promise<{ jobId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { jobId } = await params;
  const { data: job, error } = await owner.database.from("job_opportunities").select("id, title, company_name, status").eq("id", jobId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("SAVED_JOB_UNAVAILABLE");
  if (!job || job.status !== "SAVED") notFound();
  const resume = await loadResumeView(owner.database, owner.user.id, job.id);
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs"><main className="mx-auto max-w-7xl"><Link href={`/app/jobs/saved/${job.id}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> Career Match</Link><header className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Gate 8 · Tailored Resume Engine</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-[-.04em] text-[#183A5A] sm:text-5xl">{job.title}</h1><p className="mt-2 text-base font-semibold text-[#64748B]">{job.company_name}</p></div><Link href={`/app/jobs/saved/${job.id}/contacts`} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white"><Users className="size-4" /> Find Hiring Contacts</Link></header><ResumeStudio jobId={job.id} jobTitle={job.title} employer={job.company_name} resume={resume} /></main></AppShell>;
}
