import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { AdminDashboard, type PendingProof, type UpcomingClientSession, type UpcomingConsultation } from "@/components/dashboard/admin-dashboard";
import { DashboardViewSwitch } from "@/components/dashboard/view-switch";
import { UserBookingView, type PublicBookingSettings } from "@/components/dashboard/user-booking-view";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { googleMailOauthMessage } from "@/lib/mail/connection-status";

export const metadata = { title: "Dashboard" };

const activityLabels: Record<string, string> = {
  PROJECT_CREATED: "Project created",
  PROJECT_UPDATED: "Project updated",
  STATUS_CHANGED: "Project status changed",
  MESSAGE_SENT: "Project email sent",
  REPLY_RECEIVED: "Reply received"
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string; mailError?: string; mailConnected?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { database, user } = owner;
  const now = new Date().toISOString();
  const query = await searchParams;
  const view = query.view === "user" ? "user" : "admin";
  const [
    { count: unreadCount, error: unreadError },
    { count: activeProjectCount, error: projectCountError },
    { data: projects, error: projectsError },
    { data: threads, error: threadsError },
    { data: identities, error: identitiesError },
    { data: activity, error: activityError },
    { count: scheduledCount, error: scheduledCountError },
    { data: nextScheduled, error: nextScheduledError },
    { count: savedJobsCount, error: savedJobsCountError },
    { data: recentJobs, error: recentJobsError },
    { data: pendingProofs, error: pendingConsultationsError },
    { count: releasedCount, error: releasedError },
    { data: upcomingConsultations, error: upcomingConsultationsError },
    { data: sessionRows, error: sessionError },
    { count: activeClients, error: clientsError },
    { data: settings, error: settingsError },
    { data: connection, error: connectionError }
  ] = await Promise.all([
    database.from("mail_threads").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("is_unread", true),
    database.from("projects").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "ACTIVE"),
    database.from("projects").select("id, name, type, status, updated_at").eq("owner_id", user.id).neq("status", "ARCHIVED").order("updated_at", { ascending: false }).limit(4),
    database.from("mail_threads").select("id, subject, snippet, last_message_at, is_unread").eq("owner_id", user.id).order("last_message_at", { ascending: false }).limit(5),
    database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", user.id).order("is_default", { ascending: false }),
    database.from("project_activity").select("id, project_id, activity_type, occurred_at").eq("owner_id", user.id).order("occurred_at", { ascending: false }).limit(6),
    database.from("scheduled_messages").select("id", { count: "exact", head: true }).eq("owner_id", user.id).in("status", ["SCHEDULED", "PROCESSING"]),
    database.from("scheduled_messages").select("id, subject, scheduled_for, timezone").eq("owner_id", user.id).eq("status", "SCHEDULED").order("scheduled_for").limit(1).maybeSingle(),
    database.from("job_opportunities").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("status", "SAVED"),
    database.from("job_opportunities").select("id, title, company_name, location_text, saved_at").eq("owner_id", user.id).eq("status", "SAVED").order("saved_at", { ascending: false }).limit(3),
    database.from("consultation_requests").select("id, client_name, client_email, consultation_type, expected_amount_cents, created_at").eq("owner_id", user.id).eq("payment_status", "PAYMENT_SUBMITTED").order("created_at", { ascending: false }).limit(5),
    database.from("consultation_requests").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("payment_status", "BOOKING_RELEASED"),
    database.from("consultation_requests").select("id, client_name, consultation_type, booking_start_at, booking_timezone").eq("owner_id", user.id).eq("payment_status", "BOOKED").gte("booking_start_at", now).order("booking_start_at").limit(5),
    database.from("client_session_bookings").select("id, client_id, guest_name, booking_title, booking_start_at").eq("owner_id", user.id).eq("status", "BOOKED").gte("booking_start_at", now).order("booking_start_at").limit(5),
    database.from("clients").select("id", { count: "exact", head: true }).eq("owner_id", user.id).eq("is_active", true),
    database.from("consultation_settings").select("is_active, client_sessions_active, client_session_booking_url, zelle_recipient_name, zelle_contact, payment_instructions, reference_instructions").eq("owner_id", user.id).maybeSingle(),
    database.from("mail_connections").select("provider_account_id, connection_state, initial_sync_completed_at, last_synced_at, sync_error").eq("owner_id", user.id).eq("provider", "google").maybeSingle()
  ]);
  if (unreadError || projectCountError || projectsError || threadsError || identitiesError || activityError || scheduledCountError || nextScheduledError || savedJobsCountError || recentJobsError || pendingConsultationsError || releasedError || upcomingConsultationsError || sessionError || clientsError || settingsError || connectionError) throw new Error("DASHBOARD_UNAVAILABLE");

  const activityProjectIds = [...new Set((activity ?? []).map((item) => item.project_id))];
  const sessionClientIds = [...new Set((sessionRows ?? []).flatMap((item) => item.client_id ? [item.client_id] : []))];
  const [{ data: activityProjects, error: activityProjectsError }, { data: sessionClients, error: sessionClientsError }, { data: resumeVersions, error: resumeError }] = await Promise.all([
    activityProjectIds.length
      ? database.from("projects").select("id, name").eq("owner_id", user.id).in("id", activityProjectIds)
      : Promise.resolve({ data: [], error: null }),
    sessionClientIds.length
      ? database.from("clients").select("id, full_name").eq("owner_id", user.id).in("id", sessionClientIds)
      : Promise.resolve({ data: [], error: null }),
    database.from("tailored_resume_versions").select("status, approved_at").eq("owner_id", user.id).in("status", ["REVIEW", "APPROVED", "STALE"])
  ]);
  if (activityProjectsError || sessionClientsError || resumeError) throw new Error("DASHBOARD_UNAVAILABLE");

  const projectNames = new Map((activityProjects ?? []).map((project) => [project.id, project.name]));
  const clientNames = new Map((sessionClients ?? []).map((client) => [client.id, client.full_name]));
  const usableIdentities = (identities ?? []).filter((identity) => identity.is_active && identity.send_as_state === "available");
  const resumeNeedsReview = (resumeVersions ?? []).filter((version) => version.status === "REVIEW").length;
  const approvedResumes = (resumeVersions ?? []).filter((version) => Boolean(version.approved_at)).length;
  const staleResumes = (resumeVersions ?? []).filter((version) => version.status === "STALE").length;
  const bookingSettings = settings as PublicBookingSettings | null;
  const upcomingSessions: UpcomingClientSession[] = (sessionRows ?? []).map((item) => ({
    id: item.id,
    client_id: item.client_id,
    client_name: item.guest_name ?? (item.client_id ? clientNames.get(item.client_id) ?? "Client" : "Guest"),
    booking_title: item.booking_title,
    booking_start_at: item.booking_start_at
  }));
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" }).format(new Date());

  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="dashboard">
      <div className="mx-auto max-w-6xl">
        <DashboardViewSwitch view={view} mailError={query.mailError} mailConnected={query.mailConnected} />
        <div className="mt-8">
          {view === "user" ? <UserBookingView settings={bookingSettings} /> : (
            <AdminDashboard
              todayLabel={todayLabel}
              oauthMessage={googleMailOauthMessage(query.mailError, query.mailConnected === "true")}
              connection={connection ?? null}
              usableIdentityCount={usableIdentities.length}
              unreadCount={unreadCount ?? 0}
              activeProjectCount={activeProjectCount ?? 0}
              scheduledCount={scheduledCount ?? 0}
              nextScheduledSubject={nextScheduled?.subject ?? null}
              savedJobsCount={savedJobsCount ?? 0}
              pendingProofs={(pendingProofs ?? []) as PendingProof[]}
              releasedCount={releasedCount ?? 0}
              upcomingConsultations={(upcomingConsultations ?? []) as UpcomingConsultation[]}
              upcomingSessions={upcomingSessions}
              intakeOpen={Boolean(bookingSettings?.is_active)}
              sessionsOpen={Boolean(bookingSettings?.client_sessions_active && bookingSettings.client_session_booking_url)}
              activeClients={activeClients ?? 0}
              resumeNeedsReview={resumeNeedsReview}
              approvedResumes={approvedResumes}
              staleResumes={staleResumes}
              threads={threads ?? []}
              projects={projects ?? []}
              recentJobs={recentJobs ?? []}
              activity={(activity ?? []).map((item) => ({
                id: item.id,
                label: activityLabels[item.activity_type] ?? "Project activity",
                projectName: projectNames.get(item.project_id) ?? "Project",
                occurred_at: item.occurred_at
              }))}
            />
          )}
        </div>
      </div>
    </AppShell>
  );
}
