import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ResumeStudio } from "@/components/resume-studio";
import { ResumeShareControls } from "@/components/resume-share-controls";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadResumeView } from "@/lib/resumes/store";
import { loadApprovedMasterResume } from "@/lib/resumes/master";

export const metadata = { title: "Tailored Resume" };

export default async function TailoredResumePage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ project?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { jobId } = await params;
  const { data: job, error } = await owner.database.from("job_opportunities").select("id, title, company_name, status").eq("id", jobId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("SAVED_JOB_UNAVAILABLE");
  if (!job || job.status !== "SAVED") notFound();
  const [{ project }, resume, master] = await Promise.all([searchParams, loadResumeView(owner.database, owner.user.id, job.id), loadApprovedMasterResume(owner.database, owner.user.id)]);
  const shareVersion = resume?.versions.find((version) => version.id === resume.currentVersionId && Boolean(version.approvedAt) && ["APPROVED", "STALE"].includes(version.status)) ?? null;
  const { data: shareRows } = shareVersion ? await owner.database.from("resume_shares").select("id, resume_version_id, label, status, created_at, revoked_at, access_count").eq("owner_id", owner.user.id).eq("resume_version_id", shareVersion.id).order("created_at", { ascending: false }) : { data: [] };
  const shares = (shareRows ?? []).map((share) => ({ id: share.id, resumeVersionId: share.resume_version_id, label: share.label, status: share.status as "ACTIVE" | "REVOKED", createdAt: share.created_at, revokedAt: share.revoked_at, accessCount: Number(share.access_count ?? 0) }));
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs"><main className="mx-auto max-w-7xl"><Link href={`/app/jobs/saved/${job.id}${project ? `?project=${project}` : ""}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#70626A]"><ArrowLeft className="size-4" /> Career Match</Link><header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#8D2948]">Gate 7 · Interactive Resume Studio</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-[-.04em] text-[#3E1D2C] sm:text-5xl">{job.title}</h1><p className="mt-2 text-base font-semibold text-[#70626A]">{job.company_name}</p></header><ResumeStudio jobId={job.id} jobTitle={job.title} employer={job.company_name} resume={resume} masterApproved={Boolean(master)} projectId={project ?? null} />{resume && shareVersion && <div className="mt-6"><ResumeShareControls resumeId={resume.id} versionId={shareVersion.id} shares={shares} /></div>}</main></AppShell>;
}
