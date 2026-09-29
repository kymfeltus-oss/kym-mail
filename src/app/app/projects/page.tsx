import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FolderPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProjectStatusControls } from "@/components/project-status-controls";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/validation";

export const metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const archivedView = (await searchParams).view === "archived";
  const { data: projects, error } = await owner.database.from("projects").select("id, name, type, objective, status, updated_at").eq("owner_id", owner.user.id).order("updated_at", { ascending: false });
  if (error) throw new Error("PROJECTS_UNAVAILABLE");
  const visible = (projects ?? []).filter((project) => archivedView ? project.status === "ARCHIVED" : project.status !== "ARCHIVED");
  const activeCount = (projects ?? []).filter((project) => project.status !== "ARCHIVED").length;
  const archivedCount = (projects ?? []).filter((project) => project.status === "ARCHIVED").length;

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="projects">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Contextual operating layer</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#F4F7FB] sm:text-4xl">Projects</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">Projects keep objectives and outreach context together while shared mail tools stay global.</p></div><Link href="/app/projects/new" className="inline-flex items-center gap-2 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.22)]"><FolderPlus className="size-4" /> New Project</Link></header>
      <nav aria-label="Project views" className="mt-8 flex gap-2 rounded-2xl border border-[#1C283C] bg-[#101828] p-2 sm:w-fit"><Link href="/app/projects" aria-current={!archivedView ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${!archivedView ? "bg-[#123044] text-[#67E8F9]" : "text-[#93A0B5]"}`}>Current <span className="ml-1 text-xs">{activeCount}</span></Link><Link href="/app/projects?view=archived" aria-current={archivedView ? "page" : undefined} className={`rounded-xl px-4 py-2 text-sm font-semibold ${archivedView ? "bg-[#123044] text-[#67E8F9]" : "text-[#93A0B5]"}`}>Archived <span className="ml-1 text-xs">{archivedCount}</span></Link></nav>

      {visible.length ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{visible.map((project) => <article key={project.id} className="flex min-h-64 flex-col rounded-3xl border border-[#1C283C] bg-[#101828] p-6 shadow-[0_14px_42px_rgba(0,0,0,.06)]"><div className="flex items-start justify-between gap-3"><span className="rounded-full bg-[#122033] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#67E8F9]">{projectTypeLabels[project.type as ProjectType]}</span><span className="text-xs font-semibold text-[#93A0B5]">{projectStatusLabels[project.status as ProjectStatus]}</span></div><h2 className="mt-5 text-xl font-semibold tracking-[-.02em] text-[#F4F7FB]">{project.name}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-[#93A0B5]">{project.objective}</p><div className="mt-auto pt-6"><ProjectStatusControls projectId={project.id} status={project.status as ProjectStatus} compact /><Link href={`/app/projects/${project.id}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#67E8F9]">Open Project <ArrowRight className="size-4" /></Link></div></article>)}</div> : <section className="mt-6 rounded-3xl border border-dashed border-[#1D4E89] bg-[#122033]/60 p-8 text-center sm:p-12"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#123044] text-[#22D3EE]"><FolderPlus className="size-5" /></span><h2 className="mt-5 text-xl font-semibold text-[#F4F7FB]">{archivedView ? "No archived Projects" : "Create your first Project"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#93A0B5]">{archivedView ? "Projects you archive remain available here for restoration." : "Start with the work you are organizing. Ordinary mail will still work without a Project."}</p>{!archivedView && <Link href="/app/projects/new" className="mt-5 inline-flex items-center gap-2 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white">New Project <ArrowRight className="size-4" /></Link>}</section>}
    </div>
  </AppShell>;
}
