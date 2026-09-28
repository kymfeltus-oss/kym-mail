import Link from "next/link";
import { AlertTriangle, ArrowRight, BriefcaseBusiness, CalendarCheck2, CalendarClock, Clock3, ExternalLink, FileCheck2, FolderKanban, Inbox, MailCheck, Plus, SquarePen, Users } from "lucide-react";
import { GmailConnectionPanel } from "@/components/gmail-connection-panel";
import type { GoogleMailConnection } from "@/lib/mail/connection-status";
import { formatMailTimestamp } from "@/lib/mail/date-format";
import { formatConsultationAmount } from "@/lib/consultations/validation";
import { projectStatusLabels, projectTypeLabels, type ProjectStatus, type ProjectType } from "@/lib/projects/validation";

export type PendingProof = {
  id: string;
  client_name: string;
  client_email: string;
  consultation_type: string;
  expected_amount_cents: number;
  created_at: string;
};

export type UpcomingConsultation = {
  id: string;
  client_name: string;
  consultation_type: string;
  booking_start_at: string | null;
  booking_timezone: string | null;
};

export type UpcomingClientSession = {
  id: string;
  client_id: string | null;
  client_name: string;
  booking_title: string | null;
  booking_start_at: string | null;
};

type ProjectRow = { id: string; name: string; type: string; status: string; updated_at: string };
type ThreadRow = { id: string; subject: string; snippet: string | null; last_message_at: string; is_unread: boolean };
type JobRow = { id: string; title: string; company_name: string; location_text: string | null };
type ActivityRow = { id: string; label: string; projectName: string; occurred_at: string };

export function AdminDashboard({
  todayLabel,
  oauthMessage,
  connection,
  usableIdentityCount,
  unreadCount,
  activeProjectCount,
  scheduledCount,
  nextScheduledSubject,
  savedJobsCount,
  pendingProofs,
  releasedCount,
  upcomingConsultations,
  upcomingSessions,
  intakeOpen,
  sessionsOpen,
  activeClients,
  resumeNeedsReview,
  approvedResumes,
  staleResumes,
  threads,
  projects,
  recentJobs,
  activity
}: {
  todayLabel: string;
  oauthMessage: string | null;
  connection: GoogleMailConnection;
  usableIdentityCount: number;
  unreadCount: number;
  activeProjectCount: number;
  scheduledCount: number;
  nextScheduledSubject: string | null;
  savedJobsCount: number;
  pendingProofs: PendingProof[];
  releasedCount: number;
  upcomingConsultations: UpcomingConsultation[];
  upcomingSessions: UpcomingClientSession[];
  intakeOpen: boolean;
  sessionsOpen: boolean;
  activeClients: number;
  resumeNeedsReview: number;
  approvedResumes: number;
  staleResumes: number;
  threads: ThreadRow[];
  projects: ProjectRow[];
  recentJobs: JobRow[];
  activity: ActivityRow[];
}) {
  const nextMeeting = upcomingConsultations[0] ?? null;
  const nextSession = upcomingSessions[0] ?? null;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Admin view · {todayLabel}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Bookings and workspace.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Review payment proofs, see paid consultations and 15-minute sessions, then continue through mail and projects.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/app/calendar" className="inline-flex items-center gap-2 rounded-full border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-3 text-sm font-semibold text-[#A73D52]">Review bookings</Link>
          <Link href="/consult" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] bg-white px-5 py-3 text-sm font-semibold text-[#183A5A]">Public page <ExternalLink className="size-4" /></Link>
          <Link href="/app/compose" className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)]"><SquarePen className="size-4" /> Compose</Link>
        </div>
      </header>

      <section className="mt-8 overflow-hidden rounded-[2rem] bg-[#183A5A] p-6 text-white shadow-[0_18px_50px_rgba(24,58,90,.18)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#F3A0A0]">Needs attention</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
              {pendingProofs.length ? `${pendingProofs.length} payment proof${pendingProofs.length === 1 ? "" : "s"} waiting` : "No payment proofs waiting"}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
              {nextMeeting?.booking_start_at
                ? `Next paid consultation: ${nextMeeting.client_name} · ${formatMailTimestamp(nextMeeting.booking_start_at)}`
                : nextSession?.booking_start_at
                  ? `Next 15-minute session: ${nextSession.client_name} · ${formatMailTimestamp(nextSession.booking_start_at)}`
                  : "No upcoming meetings on the calendar."}
            </p>
          </div>
          <Link href="/app/calendar" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#183A5A]">
            Open review <ArrowRight className="size-4" />
          </Link>
        </div>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white/10 px-4 py-3"><dt className="text-xs text-white/60">Paid intake</dt><dd className="mt-1 text-sm font-semibold">{intakeOpen ? "Open" : "Closed"}</dd></div>
          <div className="rounded-2xl bg-white/10 px-4 py-3"><dt className="text-xs text-white/60">15-minute sessions</dt><dd className="mt-1 text-sm font-semibold">{sessionsOpen ? "Open" : "Closed"}</dd></div>
          <div className="rounded-2xl bg-white/10 px-4 py-3"><dt className="text-xs text-white/60">Booking links sent</dt><dd className="mt-1 text-sm font-semibold">{releasedCount}</dd></div>
          <div className="rounded-2xl bg-white/10 px-4 py-3"><dt className="text-xs text-white/60">Active clients</dt><dd className="mt-1 text-sm font-semibold">{activeClients}</dd></div>
        </dl>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <BookingList
          title="Payment review"
          emptyTitle="No pending submissions"
          emptyBody="New Zelle proofs will appear here."
          actionHref="/app/calendar"
          actionLabel="Review"
        >
          {pendingProofs.map((item) => (
            <Link key={item.id} href="/app/calendar" className="block rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#183A5A]">{item.client_name}</p>
                  <p className="mt-1 truncate text-xs text-[#64748B]">{item.consultation_type}</p>
                </div>
                <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">{formatConsultationAmount(item.expected_amount_cents)}</span>
              </div>
              <p className="mt-3 truncate text-xs text-[#7A8795]">{item.client_email} · {formatMailTimestamp(item.created_at)}</p>
            </Link>
          ))}
        </BookingList>

        <BookingList
          title="Paid consultations"
          emptyTitle="No upcoming consultations"
          emptyBody="Approved bookings show here after Cal.com confirms them."
          actionHref="/app/calendar"
          actionLabel="Calendar"
        >
          {upcomingConsultations.map((item) => (
            <Link key={item.id} href="/app/calendar" className="flex gap-3 rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarCheck2 className="size-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#183A5A]">{item.client_name}</span>
                <span className="mt-1 block truncate text-xs text-[#64748B]">{item.booking_start_at ? formatMailTimestamp(item.booking_start_at) : "Time pending"}</span>
                <span className="mt-1 block truncate text-xs text-[#7A8795]">{item.consultation_type}</span>
              </span>
            </Link>
          ))}
        </BookingList>

        <BookingList
          title="15-minute sessions"
          emptyTitle="No upcoming client sessions"
          emptyBody="Booked 15-minute sessions show here, including bookings made without an account."
          actionHref="/app/clients"
          actionLabel="Clients"
        >
          {upcomingSessions.map((item) => (
            <Link key={item.id} href={item.client_id ? `/app/clients/${item.client_id}` : "/app/calendar"} className="flex gap-3 rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FFF3F4] text-[#A73D52]"><Clock3 className="size-5" /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#183A5A]">{item.client_name}</span>
                <span className="mt-1 block truncate text-xs text-[#64748B]">{item.booking_start_at ? formatMailTimestamp(item.booking_start_at) : "Time pending"}</span>
                <span className="mt-1 block truncate text-xs text-[#7A8795]">{item.booking_title ?? "15-minute client session"}</span>
              </span>
            </Link>
          ))}
        </BookingList>
      </div>

      <GmailConnectionPanel connection={connection} availableIdentityCount={usableIdentityCount} oauthMessage={oauthMessage} />

      <section aria-label="Workspace summary" className="mt-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryLink href="/app/inbox" icon={<Inbox className="size-5" />} value={unreadCount} label={`Unread thread${unreadCount === 1 ? "" : "s"}`} />
        <SummaryLink href="/app/projects" icon={<FolderKanban className="size-5" />} value={activeProjectCount} label={`Active Project${activeProjectCount === 1 ? "" : "s"}`} />
        <SummaryCard icon={<MailCheck className="size-5" />} value={usableIdentityCount} label={`Verified sender${usableIdentityCount === 1 ? "" : "s"}`} />
        <SummaryLink href="/app/scheduled" icon={<CalendarClock className="size-5" />} value={scheduledCount} label={`Scheduled email${scheduledCount === 1 ? "" : "s"}`} detail={nextScheduledSubject ? `Next: ${nextScheduledSubject}` : null} />
        <SummaryLink href="/app/jobs/saved" icon={<BriefcaseBusiness className="size-5" />} value={savedJobsCount} label={`Saved job${savedJobsCount === 1 ? "" : "s"}`} />
      </section>

      <section aria-label="Resume status" className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniStat href="/app/jobs/saved" icon={<FileCheck2 className="size-5" />} tone="review" value={resumeNeedsReview} label={`Resume version${resumeNeedsReview === 1 ? "" : "s"} needing review`} />
        <MiniStat href="/app/jobs/saved" icon={<FileCheck2 className="size-5" />} tone="ready" value={approvedResumes} label={`Approved snapshot${approvedResumes === 1 ? "" : "s"}`} />
        <MiniStat href="/app/jobs/saved" icon={<AlertTriangle className="size-5" />} tone="alert" value={staleResumes} label={`Stale resume${staleResumes === 1 ? "" : "s"}`} />
      </section>

      <div className="mt-8 grid min-w-0 gap-8 xl:grid-cols-[1.15fr_.85fr]">
        <section className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Mail</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recent conversations</h2></div>
            <Link href="/app/inbox" className="text-sm font-semibold text-[#A73D52]">View Inbox</Link>
          </div>
          {threads.length ? (
            <div className="mt-5 divide-y divide-[#E8E2E3]">
              {threads.map((thread) => (
                <Link key={thread.id} href={`/app/thread/${thread.id}`} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                  <span className={`mt-2 size-2 shrink-0 rounded-full ${thread.is_unread ? "bg-[#D95B72]" : "bg-[#D7D2D3]"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap justify-between gap-2">
                      <strong className="truncate text-sm text-[#183A5A]">{thread.subject}</strong>
                      <time className="text-xs text-[#64748B]">{formatMailTimestamp(thread.last_message_at)}</time>
                    </span>
                    <span className="mt-1 block truncate text-sm text-[#64748B]">{thread.snippet || "No preview available."}</span>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#FFF3F4] p-5">
              <p className="text-sm font-semibold text-[#183A5A]">No mail activity yet</p>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">Synchronized conversations will appear here.</p>
            </div>
          )}
        </section>

        <section className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Context</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Projects</h2></div>
            <div className="flex items-center gap-3">
              <Link href="/app/projects/new" className="inline-flex items-center gap-1 text-sm font-semibold text-[#526173]"><Plus className="size-4" /> New</Link>
              <Link href="/app/projects" className="text-sm font-semibold text-[#A73D52]">View all</Link>
            </div>
          </div>
          {projects.length ? (
            <div className="mt-5 space-y-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/app/projects/${project.id}`} className="block rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-[#183A5A]">{project.name}</h3>
                      <p className="mt-1 text-xs text-[#64748B]">{projectTypeLabels[project.type as ProjectType]}</p>
                    </div>
                    <span className="rounded-full bg-[#F7DDE1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#A73D52]">{projectStatusLabels[project.status as ProjectStatus]}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl bg-[#FFF3F4] p-5">
              <p className="text-sm font-semibold text-[#183A5A]">No Projects yet</p>
              <p className="mt-1 text-sm leading-6 text-[#64748B]">Create a Project when outreach needs shared context.</p>
              <Link href="/app/projects/new" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#A73D52]">Create Project <ArrowRight className="size-4" /></Link>
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Opportunities</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recently saved jobs</h2></div>
          <Link href="/app/jobs" className="text-sm font-semibold text-[#A73D52]">Search Jobs</Link>
        </div>
        {recentJobs.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {recentJobs.map((job) => (
              <Link key={job.id} href={`/app/jobs/saved/${job.id}`} className="min-w-0 rounded-2xl border border-[#E8E2E3] p-4 transition hover:border-[#E7B8C1] hover:bg-[#FFF3F4]">
                <p className="break-words text-sm font-semibold text-[#183A5A]">{job.title}</p>
                <p className="mt-1 truncate text-xs text-[#64748B]">{job.company_name}{job.location_text ? ` · ${job.location_text}` : ""}</p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-2xl bg-[#FFF3F4] p-5">
            <p className="text-sm font-semibold text-[#183A5A]">No saved opportunities yet</p>
            <p className="mt-1 text-sm leading-6 text-[#64748B]">Real jobs you save will appear here.</p>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">People</p>
            <h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Paying clients</h2>
          </div>
          <Link href="/app/clients" className="inline-flex items-center gap-2 text-sm font-semibold text-[#A73D52]"><Users className="size-4" /> Manage clients</Link>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#64748B]">{activeClients} active client{activeClients === 1 ? "" : "s"}. Client numbers, payments, and 15-minute sessions are managed from the client list.</p>
      </section>

      <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Project activity</p>
        <h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recent context changes</h2>
        {activity.length ? (
          <ol className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activity.map((item) => (
              <li key={item.id} className="rounded-2xl border border-[#E8E2E3] p-4">
                <p className="text-sm font-semibold text-[#183A5A]">{item.label}</p>
                <p className="mt-1 truncate text-xs text-[#64748B]">{item.projectName}</p>
                <time className="mt-3 block text-[11px] text-[#94A3B8]">{formatMailTimestamp(item.occurred_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 text-sm leading-6 text-[#64748B]">Real Project changes and Project-linked mail activity will appear here.</p>
        )}
      </section>
    </div>
  );
}

function BookingList({
  title,
  emptyTitle,
  emptyBody,
  actionHref,
  actionLabel,
  children
}: {
  title: string;
  emptyTitle: string;
  emptyBody: string;
  actionHref: string;
  actionLabel: string;
  children: React.ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <section className="rounded-3xl border border-[#E8E2E3] bg-white p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-[#183A5A]">{title}</h2>
        <Link href={actionHref} className="text-sm font-semibold text-[#A73D52]">{actionLabel}</Link>
      </div>
      {hasItems ? <div className="mt-4 space-y-3">{children}</div> : (
        <div className="mt-4 rounded-2xl bg-[#F8F5F4] p-4">
          <p className="text-sm font-semibold text-[#183A5A]">{emptyTitle}</p>
          <p className="mt-1 text-sm text-[#64748B]">{emptyBody}</p>
        </div>
      )}
    </section>
  );
}

function SummaryLink({ href, icon, value, label, detail }: { href: string; icon: React.ReactNode; value: number; label: string; detail?: string | null }) {
  return (
    <Link href={href} className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_14px_42px_rgba(24,58,90,.06)] transition hover:-translate-y-0.5">
      <span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]">{icon}</span>
      <p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{value}</p>
      <p className="mt-1 text-sm text-[#64748B]">{label}</p>
      {detail ? <p className="mt-3 truncate text-xs text-[#A73D52]">{detail}</p> : null}
    </Link>
  );
}

function SummaryCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 shadow-[0_14px_42px_rgba(24,58,90,.06)]">
      <span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]">{icon}</span>
      <p className="mt-5 text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{value}</p>
      <p className="mt-1 text-sm text-[#64748B]">{label}</p>
    </div>
  );
}

function MiniStat({ href, icon, value, label, tone }: { href: string; icon: React.ReactNode; value: number; label: string; tone: "review" | "ready" | "alert" }) {
  const toneClass = tone === "ready" ? "bg-[#E8F7EF] text-[#176B4C]" : tone === "alert" ? "bg-[#FFF0F1] text-[#A73D52]" : "bg-[#F7F1F2] text-[#8D2948]";
  return (
    <Link href={href} className="flex items-center gap-4 rounded-2xl border border-[#E7DBD8] bg-[#FFFDFC] p-4">
      <span className={`grid size-10 place-items-center rounded-xl ${toneClass}`}>{icon}</span>
      <span><strong className="block text-xl text-[#3E1D2C]">{value}</strong><span className="text-xs text-[#70626A]">{label}</span></span>
    </Link>
  );
}
