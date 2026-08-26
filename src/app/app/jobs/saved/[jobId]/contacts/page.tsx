import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ContactIntelligenceWorkspace } from "@/components/contact-intelligence-workspace";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { getContactProviderConfiguration } from "@/lib/contacts/providers";
import { loadContactIntelligenceView } from "@/lib/contacts/store";

export const metadata = { title: "Relevant Contact" };

export default async function HiringContactsPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ project?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { jobId } = await params;
  const { project: requestedProjectId } = await searchParams;
  const { data: job, error } = await owner.database.from("job_opportunities").select("id, title, company_name, status").eq("id", jobId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("CONTACT_INTELLIGENCE_UNAVAILABLE");
  if (!job || job.status !== "SAVED") notFound();
  let projectId: string | null = null;
  if (requestedProjectId) {
    const { data: association } = await owner.database.from("job_opportunity_projects").select("project_id").eq("owner_id", owner.user.id).eq("job_opportunity_id", job.id).eq("project_id", requestedProjectId).maybeSingle();
    if (!association) notFound();
    projectId = association.project_id;
  } else {
    const { data: association } = await owner.database.from("job_opportunity_projects").select("project_id").eq("owner_id", owner.user.id).eq("job_opportunity_id", job.id).order("associated_at").limit(1).maybeSingle();
    projectId = association?.project_id ?? null;
  }
  const intelligence = await loadContactIntelligenceView(owner.database, owner.user.id, job.id, getContactProviderConfiguration());
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs"><main className="mx-auto max-w-6xl"><Link href={`/app/jobs/saved/${job.id}${projectId ? `?project=${projectId}` : ""}`} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> Career Match</Link><header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Gate 8 · Hiring Intelligence</p><h1 className="mt-2 break-words text-3xl font-semibold tracking-[-.04em] text-[#183A5A] sm:text-5xl">Find Relevant Contact</h1><p className="mt-2 break-words text-base font-semibold text-[#64748B]">{job.title} · {job.company_name}</p></header><ContactIntelligenceWorkspace jobId={job.id} jobTitle={job.title} companyName={job.company_name} projectId={projectId} initial={intelligence} /></main></AppShell>;
}
