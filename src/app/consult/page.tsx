import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandLockup } from "@/components/brand-lockup";
import { CalendarDays, Clock3, LockKeyhole, ShieldCheck } from "lucide-react";
import { ConsultationForm } from "@/components/consultations/consultation-form";
import { getClientContext } from "@/lib/clients/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consultationOfferings } from "@/lib/consultations/offerings";
import { formatConsultationAmount } from "@/lib/consultations/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultations", description: "Submit payment proof for a KYM Mail consultation.", robots: { index: true, follow: true } };

export default async function ConsultPage({ searchParams }: { searchParams: Promise<{ booking?: string; kind?: string }> }) {
  const query = await searchParams;
  const clientContext = await getClientContext();
  if (query.kind === "RETURNING" && !clientContext) redirect("/client/sign-in");
  const database = clientContext?.database ?? createSupabaseAdminClient();
  const { data: settings } = await database.from("consultation_settings").select("is_active, zelle_recipient_name, zelle_contact, payment_instructions, reference_instructions").eq("is_active", true).limit(1).maybeSingle();
  const offerings = Object.values(consultationOfferings);

  return <main className="min-h-screen bg-[#05070D] px-4 py-6 sm:px-8 lg:py-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4"><BrandLockup href="/" priority /><Link href="/sign-in" className="text-sm font-semibold text-[#93A0B5]">Owner sign in</Link></header>
      {query.booking && <p role="status" className="mt-6 rounded-2xl border border-[#6B5420] bg-[#1C1708] px-5 py-4 text-sm text-[#FBBF24]">That booking link is invalid, expired, already used, or temporarily unavailable.</p>}
      <section className="grid min-w-0 gap-10 py-12 lg:grid-cols-[.88fr_1.12fr] lg:items-start lg:py-20">
        <div className="min-w-0 lg:sticky lg:top-10"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Paid consultations</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] text-[#F4F7FB] sm:text-6xl">Choose the right consultation.</h1><p className="mt-5 max-w-xl text-base leading-7 text-[#93A0B5]">No account is required for the first-time consultation. The 1 Hour Consultation asks you to log in first.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-1">{offerings.map((offering) => <article key={offering.kind} className="rounded-3xl bg-[#0E1C33] p-6 text-white"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="font-semibold">{offering.name}</p><p className="mt-2 flex items-center gap-2 text-sm text-white/65"><Clock3 className="size-4" /> {offering.durationMinutes} minutes</p></div><p className="text-2xl font-semibold">{formatConsultationAmount(offering.priceCents)}</p></div><p className="mt-4 text-xs leading-5 text-white/65">{offering.kind === "RETURNING" ? "Login required after a completed first-time consultation." : "No login required."}</p></article>)}</div>
          <ul className="mt-6 grid gap-3 text-sm text-[#93A0B5] sm:grid-cols-3 lg:grid-cols-1"><li className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#22D3EE]" /> Proof stays private</li><li className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#22D3EE]" /> Manual owner approval</li><li className="flex items-center gap-2"><CalendarDays className="size-4 text-[#22D3EE]" /> Scheduling through Cal.com</li></ul>
        </div>
        {settings ? <div className="min-w-0" id="intake"><div className="mb-5 min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Zelle payment</p><div className="mt-4 rounded-2xl bg-[#122033] p-5"><p className="break-words text-sm font-semibold text-[#67E8F9]">Pay with Zelle to {settings.zelle_recipient_name}</p><p className="mt-1 break-words text-sm font-semibold text-[#F4F7FB]">{settings.zelle_contact}</p><p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-[#93A0B5]">{settings.payment_instructions}</p>{settings.reference_instructions && <p className="mt-2 break-words text-sm leading-6 text-[#93A0B5]">Reference: {settings.reference_instructions}</p>}</div><p className="mt-4 text-xs leading-5 text-[#93A0B5]">KYM Mail does not connect to Zelle. Payment proof is reviewed manually by the owner.</p></div><ConsultationForm initialKind={query.kind === "RETURNING" ? "RETURNING" : "FIRST_TIME"} client={clientContext ? { name: clientContext.client.full_name, email: clientContext.client.email } : null} /></div> : <div className="min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-8"><h2 className="text-xl font-semibold text-[#F4F7FB]">Paid consultation intake is not open yet.</h2><p className="mt-3 text-sm leading-6 text-[#93A0B5]">The owner is finishing the payment instructions. Please check back soon.</p></div>}
      </section>
      <section id="session" className="mb-16 rounded-[2rem] border border-[#1C283C] bg-[#101828] p-6 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-[.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Short session</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Book a 15-minute session.</h2>
            <p className="mt-4 text-sm leading-6 text-[#93A0B5]">A client account is required. Sign in, or create access with the client number you were issued.</p>
          </div>
          <div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-6">
            <h3 className="text-lg font-semibold text-[#F4F7FB]">Client account required</h3>
            <p className="mt-2 text-sm leading-6 text-[#93A0B5]">New visitors can start a first-time consultation without an account. A 15-minute session stays with registered clients.</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/client/sign-in" className="kym-action inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold text-white">Sign in</Link>
              <Link href="/client/register" className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#67E8F9]/50 px-5 text-sm font-semibold text-[#67E8F9]">Create account</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  </main>;
}
