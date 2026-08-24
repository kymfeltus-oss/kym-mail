import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3, MailPlus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProjectParameters } from "@/components/project-parameters";
import { ProjectStatusControls } from "@/components/project-status-controls";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatMailTimestamp } from "@/lib/mail/date-format";
import { projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/validation";

export const metadata = { title: "Project" };

const activityLabels: Record<string, string> = { PROJECT_CREATED: "Project created", PROJECT_UPDATED: "Project updated", STATUS_CHANGED: "Status changed", MESSAGE_SENT: "Email sent", REPLY_RECEIVED: "Reply received" };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { projectId } = await params;
  const { data: project, error } = await owner.database.from("projects").select("id, name, type, objective, status, default_mail_account_id, parameter_schema_version, parameters, created_at, updated_at").eq("id", projectId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("PROJECT_UNAVAILABLE");
  if (!project) notFound();
  const [{ data: identity, error: identityError }, { data: activity, error: activityError }, { data: threads, error: threadsError }] = await Promise.all([
    project.default_mail_account_id ? owner.database.from("mail_accounts").select("id, email_address, label, is_active, send_as_state").eq("id", project.default_mail_account_id).eq("owner_id", owner.user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    owner.database.from("project_activity").select("id, activity_type, details, occurred_at").eq("project_id", project.id).eq("owner_id", owner.user.id).order("occurred_at", { ascending: false }).limit(12),
    owner.database.from("mail_threads").select("id, subject, snippet, last_message_at, is_unread").eq("project_id", project.id).eq("owner_id", owner.user.id).order("last_message_at", { ascending: false }).limit(6)
  ]);
  if (identityError || activityError || threadsError) throw new Error("PROJECT_UNAVAILABLE");
  const identityAvailable = Boolean(identity?.is_active && identity.send_as_state === "available");
  const status = project.status as ProjectStatus;
  const type = project.type as ProjectType;

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="projects">
    <div className="mx-auto max-w-6xl">
      <Link href="/app/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> All Projects</Link>
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-[#FFF3F4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#A73D52]">{projectTypeLabels[type]}</span><span className="rounded-full border border-[#E8E2E3] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#64748B]">{projectStatusLabels[status]}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">{project.name}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#64748B]">{project.objective}</p></div><div className="flex flex-wrap gap-3">{status !== "ARCHIVED" && <Link href={`/app/projects/${project.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-5 py-3 text-sm font-semibold text-[#183A5A]"><Edit3 className="size-4" /> Edit</Link>}{status === "ACTIVE" && <Link href={`/app/compose?project=${project.id}`} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)]"><MailPlus className="size-4" /> Compose Email</Link>}</div></header>
      <ProjectStatusControls projectId={project.id} status={status} />

      {!identityAvailable && <div role="alert" className="mt-7 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-5 py-4"><p className="text-sm font-semibold text-[#A73D52]">Default sender needs attention</p><p className="mt-1 text-sm leading-6 text-[#64748B]">This Project remains valid, but its saved identity is unavailable. Compose will not silently choose another sender.</p></div>}

      <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1.2fr_.8fr]">
        <section className="min-w-0 space-y-6"><div className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7"><h2 className="text-xl font-semibold text-[#183A5A]">Overview</h2><dl className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2"><div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]">Default sender</dt><dd className={`mt-2 break-words text-sm font-semibold ${identityAvailable ? "text-[#183A5A]" : "text-[#A73D52]"}`}>{identity ? `${identity.email_address} — ${identity.label}` : "Unavailable identity"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]">Parameter schema</dt><dd className="mt-2 text-sm font-semibold text-[#183A5A]">Version {project.parameter_schema_version}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]">Created</dt><dd className="mt-2 text-sm text-[#183A5A]">{formatMailTimestamp(project.created_at)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#64748B]">Updated</dt><dd className="mt-2 text-sm text-[#183A5A]">{formatMailTimestamp(project.updated_at)}</dd></div></dl></div><ProjectParameters type={type} parameters={project.parameters as Record<string, unknown>} /></section>

        <aside className="min-w-0 space-y-6"><section className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6"><h2 className="text-lg font-semibold text-[#183A5A]">Project activity</h2>{activity?.length ? <ol className="mt-4 space-y-4">{activity.map((item) => { const details = item.details as Record<string, unknown>; return <li key={item.id} className="border-l-2 border-[#F7DDE1] pl-4"><p className="text-sm font-semibold text-[#183A5A]">{activityLabels[item.activity_type] ?? "Project activity"}</p>{item.activity_type === "STATUS_CHANGED" && <p className="mt-1 text-xs text-[#64748B]">{String(details.from ?? "")} → {String(details.to ?? "")}</p>}<time className="mt-1 block text-[11px] text-[#94A3B8]">{formatMailTimestamp(item.occurred_at)}</time></li>; })}</ol> : <p className="mt-3 text-sm leading-6 text-[#64748B]">No Project activity has been recorded.</p>}</section>
          <section className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6"><h2 className="text-lg font-semibold text-[#183A5A]">Conversations</h2>{threads?.length ? <div className="mt-4 min-w-0 divide-y divide-[#E8E2E3]">{threads.map((thread) => <Link key={thread.id} href={`/app/thread/${thread.id}`} className="block min-w-0 py-3 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${thread.is_unread ? "bg-[#D95B72]" : "bg-[#D7D2D3]"}`} /><p className="min-w-0 truncate text-sm font-semibold text-[#183A5A]">{thread.subject}</p></div><p className="mt-1 min-w-0 truncate pl-4 text-xs text-[#64748B]">{thread.snippet || "No preview available."}</p></Link>)}</div> : <p className="mt-3 text-sm leading-6 text-[#64748B]">Emails sent with this Project selected will appear here.</p>}</section></aside>
      </div>
    </div>
  </AppShell>;
}
