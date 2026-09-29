import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BriefcaseBusiness, Edit3, MailPlus, Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ProjectParameters } from "@/components/project-parameters";
import { ProjectStatusControls } from "@/components/project-status-controls";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatMailTimestamp } from "@/lib/mail/date-format";
import { projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/validation";
import { scheduledEventLabels } from "@/lib/scheduling/constants";

export const metadata = { title: "Project" };

const activityLabels: Record<string, string> = { PROJECT_CREATED: "Project created", PROJECT_UPDATED: "Project updated", STATUS_CHANGED: "Status changed", MESSAGE_SENT: "Email sent", REPLY_RECEIVED: "Reply received" };

export default async function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { projectId } = await params;
  const { data: project, error } = await owner.database.from("projects").select("id, name, type, objective, status, default_mail_account_id, parameter_schema_version, parameters, created_at, updated_at").eq("id", projectId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("PROJECT_UNAVAILABLE");
  if (!project) notFound();
  const [{ data: identity, error: identityError }, { data: activity, error: activityError }, { data: scheduledActivity, error: scheduledActivityError }, { data: threads, error: threadsError }, { data: jobAssociations, error: jobAssociationsError }, { data: jobActivity, error: jobActivityError }] = await Promise.all([
    project.default_mail_account_id ? owner.database.from("mail_accounts").select("id, email_address, label, is_active, send_as_state").eq("id", project.default_mail_account_id).eq("owner_id", owner.user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    owner.database.from("project_activity").select("id, activity_type, details, occurred_at").eq("project_id", project.id).eq("owner_id", owner.user.id).order("occurred_at", { ascending: false }).limit(12),
    owner.database.from("scheduled_message_events").select("id, event_type, details, occurred_at").eq("project_id", project.id).eq("owner_id", owner.user.id).order("occurred_at", { ascending: false }).limit(12),
    owner.database.from("mail_threads").select("id, subject, snippet, last_message_at, is_unread").eq("project_id", project.id).eq("owner_id", owner.user.id).order("last_message_at", { ascending: false }).limit(6),
    project.type === "JOB_SEARCH" ? owner.database.from("job_opportunity_projects").select("job_opportunity_id, associated_at").eq("project_id", project.id).eq("owner_id", owner.user.id).order("associated_at", { ascending: false }).limit(12) : Promise.resolve({ data: [], error: null }),
    project.type === "JOB_SEARCH" ? owner.database.from("job_project_activity").select("id, activity_type, details, occurred_at").eq("project_id", project.id).eq("owner_id", owner.user.id).order("occurred_at", { ascending: false }).limit(12) : Promise.resolve({ data: [], error: null })
  ]);
  if (identityError || activityError || scheduledActivityError || threadsError || jobAssociationsError || jobActivityError) throw new Error("PROJECT_UNAVAILABLE");
  const jobIds = (jobAssociations ?? []).map((association) => association.job_opportunity_id);
  const { data: projectJobs, error: projectJobsError } = jobIds.length ? await owner.database.from("job_opportunities").select("id, title, company_name, location_text, source_url, saved_at, status").eq("owner_id", owner.user.id).eq("status", "SAVED").in("id", jobIds) : { data: [], error: null };
  if (projectJobsError) throw new Error("PROJECT_UNAVAILABLE");
  const projectJobById = new Map((projectJobs ?? []).map((job) => [job.id, job]));
  const orderedProjectJobs = (jobAssociations ?? []).map((association) => projectJobById.get(association.job_opportunity_id)).filter((job): job is NonNullable<typeof job> => Boolean(job));
  const identityAvailable = Boolean(identity?.is_active && identity.send_as_state === "available");
  const status = project.status as ProjectStatus;
  const type = project.type as ProjectType;
  const combinedActivity = [
    ...(activity ?? []).map((item) => ({ id: `project-${item.id}`, label: activityLabels[item.activity_type] ?? "Project activity", activityType: item.activity_type, details: item.details as Record<string, unknown>, occurredAt: item.occurred_at })),
    ...(scheduledActivity ?? []).map((item) => ({ id: `schedule-${item.id}`, label: scheduledEventLabels[item.event_type] ?? "Schedule activity", activityType: item.event_type, details: item.details as Record<string, unknown>, occurredAt: item.occurred_at }))
    ,...(jobActivity ?? []).map((item) => ({ id: `job-${item.id}`, label: item.activity_type === "JOB_SAVED" ? "Job saved to Project" : "Job removed from Project", activityType: item.activity_type, details: item.details as Record<string, unknown>, occurredAt: item.occurred_at }))
  ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 12);

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="projects">
    <div className="mx-auto max-w-6xl">
      <Link href="/app/projects" className="inline-flex items-center gap-2 text-sm font-semibold text-[#93A0B5]"><ArrowLeft className="size-4" /> All Projects</Link>
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><div className="flex flex-wrap items-center gap-3"><span className="rounded-full bg-[#122033] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#67E8F9]">{projectTypeLabels[type]}</span><span className="rounded-full border border-[#1C283C] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#93A0B5]">{projectStatusLabels[status]}</span></div><h1 className="mt-4 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB] sm:text-5xl">{project.name}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-[#93A0B5]">{project.objective}</p></div><div className="flex flex-wrap gap-3">{status !== "ARCHIVED" && <Link href={`/app/projects/${project.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[#1C283C] bg-[#101828] px-5 py-3 text-sm font-semibold text-[#F4F7FB]"><Edit3 className="size-4" /> Edit</Link>}{status === "ACTIVE" && type === "JOB_SEARCH" && <Link href={`/app/jobs?project=${project.id}`} className="inline-flex items-center gap-2 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.22)]"><Search className="size-4" /> Search Jobs</Link>}{status === "ACTIVE" && <Link href={`/app/compose?project=${project.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#1D4E89] bg-[#122033] px-5 py-3 text-sm font-semibold text-[#67E8F9]"><MailPlus className="size-4" /> Compose Email</Link>}</div></header>
      <ProjectStatusControls projectId={project.id} status={status} />

      {!identityAvailable && <div role="alert" className="mt-7 rounded-2xl border border-[#1D4E89] bg-[#122033] px-5 py-4"><p className="text-sm font-semibold text-[#67E8F9]">Default sender needs attention</p><p className="mt-1 text-sm leading-6 text-[#93A0B5]">This Project remains valid, but its saved identity is unavailable. Compose will not silently choose another sender.</p></div>}

      <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1.2fr_.8fr]">
        <section className="min-w-0 space-y-6"><div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_14px_42px_rgba(0,0,0,.06)] sm:p-7"><h2 className="text-xl font-semibold text-[#F4F7FB]">Overview</h2><dl className="mt-5 grid min-w-0 gap-4 sm:grid-cols-2"><div className="min-w-0"><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#93A0B5]">Default sender</dt><dd className={`mt-2 break-words text-sm font-semibold ${identityAvailable ? "text-[#F4F7FB]" : "text-[#67E8F9]"}`}>{identity ? `${identity.email_address} — ${identity.label}` : "Unavailable identity"}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#93A0B5]">Parameter schema</dt><dd className="mt-2 text-sm font-semibold text-[#F4F7FB]">Version {project.parameter_schema_version}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#93A0B5]">Created</dt><dd className="mt-2 text-sm text-[#F4F7FB]">{formatMailTimestamp(project.created_at)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[#93A0B5]">Updated</dt><dd className="mt-2 text-sm text-[#F4F7FB]">{formatMailTimestamp(project.updated_at)}</dd></div></dl></div><ProjectParameters type={type} parameters={project.parameters as Record<string, unknown>} /></section>

        <aside className="min-w-0 space-y-6">{type === "JOB_SEARCH" && <section className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_14px_42px_rgba(0,0,0,.06)] sm:p-6"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold text-[#F4F7FB]">Jobs</h2>{status === "ACTIVE" && <Link href={`/app/jobs?project=${project.id}`} className="text-xs font-semibold text-[#67E8F9]">Search Jobs</Link>}</div>{orderedProjectJobs.length ? <div className="mt-4 space-y-3">{orderedProjectJobs.map((job) => <Link key={job.id} href={`/app/jobs/saved/${job.id}?project=${project.id}`} className="block rounded-2xl border border-[#1C283C] p-4 transition hover:border-[#1D4E89] hover:bg-[#122033]"><div className="flex items-start gap-3"><BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-[#22D3EE]" /><div className="min-w-0"><p className="break-words text-sm font-semibold text-[#F4F7FB]">{job.title}</p><p className="mt-1 truncate text-xs text-[#93A0B5]">{job.company_name}{job.location_text ? ` · ${job.location_text}` : ""}</p></div></div></Link>)}</div> : <div className="mt-4 rounded-2xl bg-[#122033] p-4"><p className="text-sm font-semibold text-[#F4F7FB]">No saved jobs in this Project</p><p className="mt-1 text-xs leading-5 text-[#93A0B5]">Search real opportunities and save the right ones into this Project.</p></div>}</section>}<section className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_14px_42px_rgba(0,0,0,.06)] sm:p-6"><h2 className="text-lg font-semibold text-[#F4F7FB]">Project activity</h2>{combinedActivity.length ? <ol className="mt-4 space-y-4">{combinedActivity.map((item) => <li key={item.id} className="border-l-2 border-[#164E63] pl-4"><p className="text-sm font-semibold text-[#F4F7FB]">{item.label}</p>{item.activityType === "STATUS_CHANGED" && <p className="mt-1 text-xs text-[#93A0B5]">{String(item.details.from ?? "")} → {String(item.details.to ?? "")}</p>}<time className="mt-1 block text-[11px] text-[#93A0B5]">{formatMailTimestamp(item.occurredAt)}</time></li>)}</ol> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No Project activity has been recorded.</p>}</section>
          <section className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_14px_42px_rgba(0,0,0,.06)] sm:p-6"><h2 className="text-lg font-semibold text-[#F4F7FB]">Conversations</h2>{threads?.length ? <div className="mt-4 min-w-0 divide-y divide-[#1C283C]">{threads.map((thread) => <Link key={thread.id} href={`/app/thread/${thread.id}`} className="block min-w-0 py-3 first:pt-0 last:pb-0"><div className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${thread.is_unread ? "kym-action" : "bg-[#122033]"}`} /><p className="min-w-0 truncate text-sm font-semibold text-[#F4F7FB]">{thread.subject}</p></div><p className="mt-1 min-w-0 truncate pl-4 text-xs text-[#93A0B5]">{thread.snippet || "No preview available."}</p></Link>)}</div> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">Emails sent with this Project selected will appear here.</p>}</section></aside>
      </div>
    </div>
  </AppShell>;
}
