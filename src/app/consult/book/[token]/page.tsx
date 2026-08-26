import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";
import { consultationOffering, type ConsultationKind } from "@/lib/consultations/offerings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Secure consultation booking", robots: { index: false, follow: false, noarchive: true, nocache: true } };

export default async function ConsultationBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isConsultationToken(token)) notFound();
  const database = createSupabaseAdminClient();
  const { data: request } = await database.from("consultation_requests").select("owner_id, client_name, consultation_type, consultation_kind, payment_status, booking_token_expires_at, provider_booking_id").eq("booking_token_hash", hashConsultationToken(token)).maybeSingle();
  const usable = request && ["PAYMENT_APPROVED", "BOOKING_RELEASED"].includes(request.payment_status) && !request.provider_booking_id && request.booking_token_expires_at && new Date(request.booking_token_expires_at).getTime() > Date.now();
  if (!usable) notFound();
  const { data: settings } = await database.from("consultation_settings").select("owner_id").eq("owner_id", request.owner_id).eq("is_active", true).maybeSingle();
  if (!settings) notFound();
  const offering = consultationOffering(request.consultation_kind as ConsultationKind);
  return <main className="grid min-h-screen place-items-center bg-[#183A5A] px-4 py-10"><section className="w-full max-w-xl rounded-[2rem] bg-[#FFFCFB] p-6 shadow-2xl sm:p-10"><Link href="/consult" className="inline-flex items-center gap-3"><Image src="/kym-mail-logo.png" alt="KYM Mail" width={40} height={40} className="size-10 rounded-xl" /><span className="font-semibold tracking-[.04em] text-[#183A5A]">KYM <span className="text-[#D95B72]">MAIL</span></span></Link><span className="mt-10 grid size-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><ShieldCheck className="size-6" /></span><p className="mt-6 text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Payment proof approved by owner</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A]">Choose your consultation time.</h1><p className="mt-4 text-sm leading-6 text-[#5E6C7D]">Hi {request.client_name}. Continue to the private Cal.com scheduling page for your {request.consultation_type}.</p><p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#183A5A]"><Clock3 className="size-4 text-[#D95B72]" /> {offering.durationMinutes} minutes</p><a href={`/api/consultations/book/${token}`} className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3.5 text-sm font-semibold text-white">Open secure scheduling <ArrowUpRight className="size-4" /></a><p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[#7A8795]"><CalendarDays className="mt-0.5 size-4 shrink-0" /> Cal.com manages availability and creates the event on the owner’s connected Google Calendar.</p></section></main>;
}
