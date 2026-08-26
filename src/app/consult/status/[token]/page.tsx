import Image from "next/image";
import Link from "next/link";
import { CalendarCheck2, CircleX, Clock3, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultation status", robots: { index: false, follow: false, noarchive: true, nocache: true } };

export default async function ConsultationStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isConsultationToken(token)) notFound();
  const database = createSupabaseAdminClient();
  const { data: request } = await database.from("consultation_requests").select("client_name, consultation_type, payment_status, rejection_reason, booking_start_at, booking_end_at, booking_timezone").eq("status_token_hash", hashConsultationToken(token)).maybeSingle();
  if (!request) notFound();
  const released = ["PAYMENT_APPROVED", "BOOKING_RELEASED"].includes(request.payment_status);
  const booked = request.payment_status === "BOOKED";
  const rejected = request.payment_status === "PAYMENT_REJECTED";
  return <main className="grid min-h-screen place-items-center bg-[#F7F3F2] px-4 py-10"><section className="w-full max-w-xl rounded-[2rem] border border-[#E8E2E3] bg-white p-6 shadow-[0_24px_70px_rgba(24,58,90,.1)] sm:p-10"><Link href="/consult" className="inline-flex items-center gap-3"><Image src="/kym-mail-logo.png" alt="KYM Mail" width={40} height={40} className="size-10 rounded-xl" /><span className="font-semibold tracking-[.04em] text-[#183A5A]">KYM <span className="text-[#D95B72]">MAIL</span></span></Link>
    <div className="mt-10">{rejected ? <CircleX className="size-10 text-red-600" /> : booked ? <CalendarCheck2 className="size-10 text-emerald-700" /> : released ? <ShieldCheck className="size-10 text-emerald-700" /> : <Clock3 className="size-10 text-amber-600" />}</div>
    <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">{request.consultation_type}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A]">{rejected ? "Payment proof not approved" : booked ? "Consultation booked" : released ? "Booking access released" : "Pending owner review"}</h1>
    <p className="mt-4 text-sm leading-6 text-[#5E6C7D]">{rejected ? `The owner did not approve the submitted payment proof. ${request.rejection_reason ?? ""}` : booked ? `Your appointment is confirmed${request.booking_start_at ? ` for ${new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: request.booking_timezone ?? undefined }).format(new Date(request.booking_start_at))}` : ""}.` : released ? "Payment proof approved by owner. Your secure scheduling access is ready." : `Hi ${request.client_name}, your payment proof was received and is awaiting manual owner review.`}</p>
    {released && <a href={`/api/consultations/status/${token}/book`} className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white">Schedule consultation <CalendarCheck2 className="size-4" /></a>}
    <p className="mt-8 border-t border-[#EEE8E8] pt-5 text-xs leading-5 text-[#7A8795]">KYM Mail does not automatically verify Zelle payments. Approval means the submitted proof was approved manually by the owner.</p>
  </section></main>;
}
