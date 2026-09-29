import Link from "next/link";
import { CalendarDays, Clock3, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { getClientContext } from "@/lib/clients/session";
import { ConsultationForm } from "@/components/consultations/consultation-form";
import { consultationOfferings } from "@/lib/consultations/offerings";
import { formatConsultationAmount } from "@/lib/consultations/validation";

export type PublicBookingSettings = {
  is_active: boolean;
  client_sessions_active: boolean;
  client_session_booking_url: string | null;
  zelle_recipient_name: string;
  zelle_contact: string;
  payment_instructions: string;
  reference_instructions: string | null;
};

export async function UserBookingView({ settings }: { settings: PublicBookingSettings | null }) {
  const clientContext = await getClientContext();
  const client = clientContext ? { name: clientContext.client.full_name, email: clientContext.client.email } : null;
  const offerings = Object.values(consultationOfferings);
  const intakeOpen = Boolean(settings?.is_active);
  const sessionsOpen = Boolean(settings?.client_sessions_active && settings.client_session_booking_url);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">User view</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB] sm:text-5xl">What people see when they book.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">This is the live public booking page. A submitted proof is a real request and appears in Admin view for review.</p>
        </div>
        <Link href="/consult" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#1D4E89] bg-[#122033] px-5 py-3 text-sm font-semibold text-[#67E8F9]">
          Open public page <ExternalLink className="size-4" />
        </Link>
      </div>

      <section className="mt-8 grid min-w-0 gap-8 lg:grid-cols-[.88fr_1.12fr] lg:items-start">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Paid consultations</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Choose the right consultation.</h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-[#93A0B5]">No account is required. Submit Zelle payment proof for manual owner review. Scheduling access is released only after the proof is approved.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {offerings.map((offering) => (
              <article key={offering.kind} className="rounded-3xl bg-[#0E1C33] p-6 text-white">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{offering.name}</p>
                    <p className="mt-2 flex items-center gap-2 text-sm text-white/65"><Clock3 className="size-4" /> {offering.durationMinutes} minutes</p>
                  </div>
                  <p className="text-2xl font-semibold">{formatConsultationAmount(offering.priceCents)}</p>
                </div>
                {offering.kind === "RETURNING" ? <p className="mt-4 text-xs leading-5 text-white/65">Available after a completed first-time consultation.</p> : null}
              </article>
            ))}
          </div>
          <ul className="mt-6 grid gap-3 text-sm text-[#93A0B5] sm:grid-cols-3 lg:grid-cols-1">
            <li className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#22D3EE]" /> Proof stays private</li>
            <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#22D3EE]" /> Manual owner approval</li>
            <li className="flex items-center gap-2"><CalendarDays className="size-4 text-[#22D3EE]" /> Scheduling through Cal.com</li>
          </ul>
        </div>

        {intakeOpen && settings ? (
          <div className="min-w-0">
            <div className="mb-5 min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-6 sm:p-8">
              <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Zelle payment</p>
              <div className="mt-4 rounded-2xl bg-[#122033] p-5">
                <p className="break-words text-sm font-semibold text-[#67E8F9]">Pay with Zelle to {settings.zelle_recipient_name}</p>
                <p className="mt-1 break-words text-sm font-semibold text-[#F4F7FB]">{settings.zelle_contact}</p>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#93A0B5]">{settings.payment_instructions}</p>
                {settings.reference_instructions ? <p className="mt-2 break-words text-sm leading-6 text-[#93A0B5]">Reference: {settings.reference_instructions}</p> : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#93A0B5]">KYM Mail does not connect to Zelle. Payment proof is reviewed manually by the owner.</p>
            </div>
            <ConsultationForm client={client} />
          </div>
        ) : (
          <div className="min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-8">
            <h2 className="text-xl font-semibold text-[#F4F7FB]">Paid consultation intake is not open yet.</h2>
            <p className="mt-3 text-sm leading-6 text-[#93A0B5]">Turn on paid submissions from the calendar settings. Visitors see this same closed state on the public page.</p>
            <Link href="/app/calendar" className="mt-6 inline-flex text-sm font-semibold text-[#67E8F9]">Open booking settings</Link>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-[2rem] border border-[#1C283C] bg-[#101828] p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Short session</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Book a 15-minute session.</h2>
            <p className="mt-4 text-sm leading-6 text-[#93A0B5]">A client account is required. Visitors sign in, or create access with a client number.</p>
            <p className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sessionsOpen ? "bg-[#0C241C] text-[#34D399]" : "bg-[#1C1708] text-[#FBBF24]"}`}>
              {sessionsOpen ? "15-minute booking is open" : "15-minute booking is closed"}
            </p>
          </div>
          <div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-6">
            <h3 className="text-lg font-semibold text-[#F4F7FB]">Client account required</h3>
            <p className="mt-2 text-sm leading-6 text-[#93A0B5]">The public page sends people to sign in or create an account before a 15-minute session.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/client/sign-in" className="kym-action inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white">Sign in</Link>
              <Link href="/client/register" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#67E8F9]/50 px-5 text-sm font-semibold text-[#67E8F9]">Create account</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
