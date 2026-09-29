import { BrandLockup } from "@/components/brand-lockup";
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
  return <main className="grid min-h-screen place-items-center bg-[#05070D] px-4 py-10"><section className="w-full max-w-xl rounded-[2rem] border border-[#1C283C] bg-[#101828] p-6 shadow-[0_24px_70px_rgba(0,0,0,.1)] sm:p-10"><BrandLockup href="/consult" />
    <div className="mt-10">{rejected ? <CircleX className="size-10 text-[#FB7185]" /> : booked ? <CalendarCheck2 className="size-10 text-[#34D399]" /> : released ? <ShieldCheck className="size-10 text-[#34D399]" /> : <Clock3 className="size-10 text-[#FBBF24]" />}</div>
    <p className="mt-5 text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">{request.consultation_type}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB]">{rejected ? "Payment proof not approved" : booked ? "Consultation booked" : released ? "Booking access released" : "Pending owner review"}</h1>
    <p className="mt-4 text-sm leading-6 text-[#93A0B5]">{rejected ? `The owner did not approve the submitted payment proof. ${request.rejection_reason ?? ""}` : booked ? `Your appointment is confirmed${request.booking_start_at ? ` for ${new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: request.booking_timezone ?? undefined }).format(new Date(request.booking_start_at))}` : ""}.` : released ? "Payment proof approved by owner. Your secure scheduling access is ready." : `Hi ${request.client_name}, your payment proof was received and is awaiting manual owner review.`}</p>
    {released && <a href={`/api/consultations/status/${token}/book`} className="mt-7 inline-flex items-center gap-2 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white">Schedule consultation <CalendarCheck2 className="size-4" /></a>}
    <p className="mt-8 border-t border-[#1C283C] pt-5 text-xs leading-5 text-[#93A0B5]">KYM Mail does not automatically verify Zelle payments. Approval means the submitted proof was approved manually by the owner.</p>
  </section></main>;
}
