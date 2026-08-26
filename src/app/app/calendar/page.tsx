import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ConsultationCalendarWorkspace } from "@/components/consultations/consultation-calendar-workspace";
import { getOwnerContext } from "@/lib/auth/owner-context";
import type { ConsultationRequest, ConsultationSettings } from "@/lib/consultations/types";

export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const now = new Date().toISOString();
  const [{ data: settings, error: settingsError }, { data: requests, error: requestsError }, { data: upcoming, error: upcomingError }] = await Promise.all([
    owner.database.from("consultation_settings").select("*").eq("owner_id", owner.user.id).maybeSingle(),
    owner.database.from("consultation_requests").select("*").eq("owner_id", owner.user.id).order("created_at", { ascending: false }).limit(100),
    owner.database.from("consultation_requests").select("*").eq("owner_id", owner.user.id).eq("payment_status", "BOOKED").gte("booking_start_at", now).order("booking_start_at").limit(25)
  ]);
  if (settingsError || requestsError || upcomingError) throw new Error("CONSULTATION_CALENDAR_UNAVAILABLE");
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="calendar"><ConsultationCalendarWorkspace settings={settings as ConsultationSettings | null} requests={(requests ?? []) as ConsultationRequest[]} upcoming={(upcoming ?? []) as ConsultationRequest[]} /></AppShell>;
}
