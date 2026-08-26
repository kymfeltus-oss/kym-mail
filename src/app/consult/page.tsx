import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Clock3, ExternalLink, LockKeyhole, ShieldCheck } from "lucide-react";
import { ConsultationForm } from "@/components/consultations/consultation-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { formatConsultationAmount } from "@/lib/consultations/validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultations", description: "Schedule a free meeting or submit payment proof for a KYM Mail consultation.", robots: { index: true, follow: true } };

export default async function ConsultPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const database = createSupabaseAdminClient();
  const [{ data: settings }, query] = await Promise.all([
    database.from("consultation_settings").select("consultation_name, duration_minutes, price_cents, cash_app_handle, payment_instructions, reference_instructions").eq("is_active", true).limit(1).maybeSingle(),
    searchParams
  ]);
  return <main className="min-h-screen bg-[#F7F3F2] px-4 py-6 sm:px-8 lg:py-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex items-center justify-between gap-4"><Link href="/" className="flex items-center gap-3"><span className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm"><Image src="/kym-mail-logo.png" alt="KYM Mail" width={44} height={44} className="size-11 object-cover" /></span><span className="font-semibold tracking-[.04em] text-[#183A5A]">KYM <span className="text-[#D95B72]">MAIL</span></span></Link><Link href="/sign-in" className="text-sm font-semibold text-[#526173]">Owner sign in</Link></header>
      {query.booking && <p role="status" className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">That booking link is invalid, expired, already used, or temporarily unavailable.</p>}
      <section className="grid min-w-0 gap-10 py-12 lg:grid-cols-[.88fr_1.12fr] lg:items-start lg:py-20">
        <div className="min-w-0 lg:sticky lg:top-10"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Calendar + consultations</p><h1 className="mt-4 text-4xl font-semibold tracking-[-.045em] text-[#183A5A] sm:text-6xl">Choose the right conversation.</h1><p className="mt-5 max-w-xl text-base leading-7 text-[#5E6C7D]">Book a free meeting directly, or submit Cash App payment proof for manual review before a paid consultation is released.</p>
          <div className="mt-8 rounded-3xl bg-[#183A5A] p-6 text-white sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-white/10"><CalendarDays className="size-5" /></span><div><p className="font-semibold">Free meeting</p><p className="text-sm text-white/65">Schedule through Cal.com</p></div></div><a href="/api/consultations/free" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#183A5A]">View availability <ExternalLink className="size-4" /></a></div>
          <ul className="mt-6 grid gap-3 text-sm text-[#526173] sm:grid-cols-3 lg:grid-cols-1"><li className="flex items-center gap-2"><LockKeyhole className="size-4 text-[#D95B72]" /> Proof stays private</li><li className="flex items-center gap-2"><ShieldCheck className="size-4 text-[#D95B72]" /> Manual owner approval</li><li className="flex items-center gap-2"><CalendarDays className="size-4 text-[#D95B72]" /> Google Calendar via Cal.com</li></ul>
        </div>
        {settings ? <div className="min-w-0"><div className="mb-5 min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Paid consultation</p><div className="mt-3 flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="break-words text-2xl font-semibold text-[#183A5A]">{settings.consultation_name}</h2><p className="mt-2 flex items-center gap-2 text-sm text-[#64748B]"><Clock3 className="size-4" /> {settings.duration_minutes} minutes</p></div><p className="text-3xl font-semibold tracking-[-.04em] text-[#183A5A]">{formatConsultationAmount(settings.price_cents)}</p></div><div className="mt-6 rounded-2xl bg-[#FFF3F4] p-5"><p className="break-words text-sm font-semibold text-[#A73D52]">Pay with Cash App: {settings.cash_app_handle}</p><p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-[#526173]">{settings.payment_instructions}</p>{settings.reference_instructions && <p className="mt-2 break-words text-sm leading-6 text-[#526173]">Reference: {settings.reference_instructions}</p>}</div><p className="mt-4 text-xs leading-5 text-[#7A8795]">KYM Mail does not connect to Cash App. Payment proof is reviewed manually by the owner.</p></div><ConsultationForm consultationName={settings.consultation_name} /></div> : <div className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-white p-8"><h2 className="text-xl font-semibold text-[#183A5A]">Paid consultation intake is not open yet.</h2><p className="mt-3 text-sm leading-6 text-[#64748B]">The owner is finishing the consultation schedule and payment instructions. Please check back soon.</p></div>}
      </section>
    </div>
  </main>;
}
