import { BrandLockup } from "@/components/brand-lockup";
import { ArrowUpRight, CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getReleasedConsultationBooking, recordBookingLinkOpened, withCalEmbed } from "@/lib/consultations/booking";
import { consultationOffering, type ConsultationKind } from "@/lib/consultations/offerings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure consultation booking", robots: { index: false, follow: false, noarchive: true, nocache: true } };

export default async function ConsultationBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = createSupabaseAdminClient();
  const released = await getReleasedConsultationBooking(database, token, "BOOKING_TOKEN");
  if (!released) notFound();
  await recordBookingLinkOpened(database, released.consultation, "BOOKING_TOKEN");
  const { consultation, bookingUrl } = released;
  const offering = consultationOffering(consultation.consultation_kind as ConsultationKind);
  return (
    <main className="min-h-screen bg-[#0E1C33] px-4 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-[2rem] bg-[#101828] p-6 shadow-2xl sm:p-10">
        <BrandLockup href="/consult" />
        <span className="mt-10 grid size-12 place-items-center rounded-2xl bg-[#0C241C] text-[#34D399]"><ShieldCheck className="size-6" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Payment proof approved by owner</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB]">Choose your consultation time.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#93A0B5]">Hi {consultation.client_name}. Pick a time below for your {consultation.consultation_type}. If the calendar does not load, open the secure scheduling page.</p>
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#F4F7FB]"><Clock3 className="size-4 text-[#22D3EE]" /> {offering.durationMinutes} minutes</p>
        <iframe
          title="Consultation scheduling calendar"
          src={withCalEmbed(bookingUrl)}
          className="mt-8 h-[min(72vh,760px)] w-full rounded-2xl border border-[#1C283C] bg-[#101828]"
          allow="payment; fullscreen"
        />
        <a href={bookingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full kym-action px-5 py-3.5 text-sm font-semibold text-white sm:w-auto">
          Open secure scheduling <ArrowUpRight className="size-4" />
        </a>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#93A0B5]"><CalendarDays className="mt-0.5 size-4 shrink-0" /> Cal.com manages availability and creates the event on the owner’s connected Google Calendar.</p>
      </section>
    </main>
  );
}
