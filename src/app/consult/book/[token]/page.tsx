import Image from "next/image";
import Link from "next/link";
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
    <main className="min-h-screen bg-[#183A5A] px-4 py-10">
      <section className="mx-auto w-full max-w-5xl rounded-[2rem] bg-[#FFFCFB] p-6 shadow-2xl sm:p-10">
        <Link href="/consult" className="inline-flex items-center gap-3">
          <Image src="/kym-mail-logo.png" alt="KYM Mail" width={40} height={40} className="size-10 rounded-xl" />
          <span className="font-semibold tracking-[.04em] text-[#183A5A]">KYM <span className="text-[#D95B72]">MAIL</span></span>
        </Link>
        <span className="mt-10 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="size-6" /></span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Payment proof approved by owner</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A]">Choose your consultation time.</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-[#5E6C7D]">Hi {consultation.client_name}. Pick a time below for your {consultation.consultation_type}. If the calendar does not load, open the secure scheduling page.</p>
        <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#183A5A]"><Clock3 className="size-4 text-[#D95B72]" /> {offering.durationMinutes} minutes</p>
        <iframe
          title="Consultation scheduling calendar"
          src={withCalEmbed(bookingUrl)}
          className="mt-8 h-[min(72vh,760px)] w-full rounded-2xl border border-[#E8E2E3] bg-white"
          allow="payment; fullscreen"
        />
        <a href={bookingUrl} target="_blank" rel="noreferrer" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3.5 text-sm font-semibold text-white sm:w-auto">
          Open secure scheduling <ArrowUpRight className="size-4" />
        </a>
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#7A8795]"><CalendarDays className="mt-0.5 size-4 shrink-0" /> Cal.com manages availability and creates the event on the owner’s connected Google Calendar.</p>
      </section>
    </main>
  );
}
