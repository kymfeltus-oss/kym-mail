import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FolderKanban, Inbox, MailCheck, Plus, SquarePen } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatMailTimestamp } from "@/lib/mail/date-format";
import { projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/validation";

export const metadata = { title: "Dashboard" };

const activityLabels: Record<string, string> = {
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
  STATUS_CHANGED: "Project status changed",
  MESSAGE_SENT: "Project email sent",
  REPLY_RECEIVED: "Reply received"
};

export default async function DashboardPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { database, user } = owner;
  const [
    { count: unreadCount, error: unreadError },
    { count: activeProjectCount, error: projectCountError },
    { data: projects, error: projectsError },
    { data: threads, error: threadsError },
    { data: identities, error: identitiesError },
    { data: activity, error: activityError }
  ] = await Promise.all([
    database.from("mail_threads").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("is_unread", true),
    database.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "ACTIVE"),
    database.from("projects").select("id, name, type, status, updated_at").eq("owner_id", user.id).neq("status", "ARCHIVED").order("updated_at", { ascending: false }).limit(4),
    database.from("mail_threads").select("id, subject, snippet, last_message_at, is_unread").eq("owner_id", user.id).order("last_message_at", { ascending: false }).limit(5),
    database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", user.id).order("is_default", { ascending: false }),
    database.from("project_activity").select("id, project_id, activity_type, occurred_at").eq("owner_id", user.id).order("occurred_at", { ascending: false }).limit(6)
  ]);
  if (unreadError || projectCountError || projectsError || threadsError || identitiesError || activityError) throw new Error("DASHBOARD_UNAVAILABLE");

  const activityProjectIds = [...new Set((activity ?? []).map((item) => item.project_id))];
  const { data: activityProjects, error: activityProjectsError } = activityProjectIds.length
    ? await database.from("projects").select("id, name").eq("owner_id", user.id).in("id", activityProjectIds)
    : { data: [], error: null };
  if (activityProjectsError) throw new Error("DASHBOARD_UNAVAILABLE");
  const projectNames = new Map((activityProjects ?? []).map((project) => [project.id, project.name]));
  const usableIdentities = (identities ?? []).filter((identity) => identity.is_active && identity.send_as_state === "available");

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="dashboard">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">KYM Mail workspace</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Your work, in context.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Move between real mail activity and the Projects guiding your outreach.</p></div>
        <div className="flex flex-wrap gap-3"><Link href="/app/projects/new" className="inline-flex items-center gap-2 rounded-full border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-3 text-sm font-semibold text-[#A73D52]"><Plus className="size-4" /> New Project</Link><Link href="/app/compose" className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)]"><SquarePen className="size-4" /> Compose</Link></div>
      </header>

      <section aria-label="Workspace summary" className="mt-9 grid gap-4 sm:grid-cols-3">
        <Link href="/app/inbox" className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_14px_42px_rgba(24,58,90,.06)] transition hover:-translate-y-0.5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><Inbox className="size-5" /></span><p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{unreadCount ?? 0}</p><p className="mt-1 text-sm text-[#64748B]">Unread thread{unreadCount === 1 ? "" : "s"}</p></Link>
        <Link href="/app/projects" className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_14px_42px_rgba(24,58,90,.06)] transition hover:-translate-y-0.5"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><FolderKanban className="size-5" /></span><p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{activeProjectCount ?? 0}</p><p className="mt-1 text-sm text-[#64748B]">Active Project{activeProjectCount === 1 ? "" : "s"}</p></Link>
        <div className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_14px_42px_rgba(24,58,90,.06)]"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><MailCheck className="size-5" /></span><p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{usableIdentities.length}</p><p className="mt-1 text-sm text-[#64748B]">Verified sender{usableIdentities.length === 1 ? "" : "s"}</p></div>
      </section>

      <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1.15fr_.85fr]">
        <section className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Mail</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recent conversations</h2></div><Link href="/app/inbox" className="text-sm font-semibold text-[#A73D52]">View Inbox</Link></div>
          {threads?.length ? <div className="mt-5 divide-y divide-[#E8E2E3]">{threads.map((thread) => <Link key={thread.id} href={`/app/thread/${thread.id}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"><span className={`mt-2 size-2 shrink-0 rounded-full ${thread.is_unread ? "bg-[#D95B72]" : "bg-[#D7D2D3]"}`} /><span className="min-w-0 flex-1"><span className="flex flex-wrap justify-between gap-2"><strong className="truncate text-sm text-[#183A5A]">{thread.subject}</strong><time className="text-xs text-[#64748B]">{formatMailTimestamp(thread.last_message_at)}</time></span><span className="mt-1 block truncate text-sm text-[#64748B]">{thread.snippet || "No preview available."}</span></span></Link>)}</div> : <div className="mt-6 rounded-2xl bg-[#FFF3F4] p-5"><p className="text-sm font-semibold text-[#183A5A]">No mail activity yet</p><p className="mt-1 text-sm leading-6 text-[#64748B]">Synchronized conversations will appear here.</p></div>}
        </section>

        <section className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Context</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Projects</h2></div><Link href="/app/projects" className="text-sm font-semibold text-[#A73D52]">View all</Link></div>
          {projects?.length ? <div className="mt-5 space-y-3">{projects.map((project) => <Link key={project.id} href={`/app/projects/${project.id}`} className="block rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[#183A5A]">{project.name}</h3><p className="mt-1 text-xs text-[#64748B]">{projectTypeLabels[project.type as ProjectType]}</p></div><span className="rounded-full bg-[#F7DDE1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#A73D52]">{projectStatusLabels[project.status as ProjectStatus]}</span></div></Link>)}</div> : <div className="mt-6 rounded-2xl bg-[#FFF3F4] p-5"><p className="text-sm font-semibold text-[#183A5A]">No Projects yet</p><p className="mt-1 text-sm leading-6 text-[#64748B]">Create a Project when outreach needs shared context.</p><Link href="/app/projects/new" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#A73D52]">Create Project <ArrowRight className="size-4" /></Link></div>}
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Project activity</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recent context changes</h2>
        {activity?.length ? <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{activity.map((item) => <li key={item.id} className="rounded-2xl border border-[#E8E2E3] p-4"><p className="text-sm font-semibold text-[#183A5A]">{activityLabels[item.activity_type] ?? "Project activity"}</p><p className="mt-1 truncate text-xs text-[#64748B]">{projectNames.get(item.project_id) ?? "Project"}</p><time className="mt-3 block text-[11px] text-[#94A3B8]">{formatMailTimestamp(item.occurred_at)}</time></li>)}</ol> : <p className="mt-5 text-sm leading-6 text-[#64748B]">Real Project changes and Project-linked mail activity will appear here.</p>}
      </section>
    </div>
  </AppShell>;
}
