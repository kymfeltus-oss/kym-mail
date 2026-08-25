import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { JobSearchWorkspace } from "@/components/job-search-workspace";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { buildProjectSearchDefaults } from "@/lib/jobs/search";

export const metadata = { title: "Search Jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { project: requestedProjectId = "" } = await searchParams;
  const { data: projects, error } = await owner.database.from("projects").select("id, name, parameters").eq("owner_id", owner.user.id).eq("type", "JOB_SEARCH").eq("status", "ACTIVE").order("updated_at", { ascending: false });
  if (error) throw new Error("JOB_PROJECTS_UNAVAILABLE");
  const selectedProject = (projects ?? []).find((project) => project.id === requestedProjectId);
  const defaults = selectedProject ? buildProjectSearchDefaults(selectedProject.parameters as Record<string, unknown>) : { query: "", location: "", workArrangement: "ANY" as const, minimumSalary: "" };

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="jobs">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Opportunity discovery</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Find the work worth pursuing.</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#64748B]">Search real U.S. opportunities, inspect source-backed details, and save the ones that belong in your next move.</p></div></header>
      <nav aria-label="Jobs" className="mt-7 inline-flex rounded-full border border-[#E8E2E3] bg-[#FFFCFB] p-1"><Link href="/app/jobs" aria-current="page" className="inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-2.5 text-sm font-semibold text-white"><Search className="size-4" /> Search Jobs</Link><Link href="/app/jobs/saved" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-[#64748B]"><Bookmark className="size-4" /> Saved Jobs</Link></nav>
      {selectedProject && <div className="mt-5 rounded-2xl border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-4"><p className="text-sm font-semibold text-[#183A5A]">Search context: {selectedProject.name}</p><p className="mt-1 text-sm leading-6 text-[#64748B]">Project parameters have pre-populated supported controls. Review or edit them before searching.</p></div>}
      <JobSearchWorkspace projects={(projects ?? []).map(({ id, name }) => ({ id, name }))} defaults={defaults} initialProjectId={selectedProject?.id ?? ""} />
    </div>
  </AppShell>;
}
