"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck2, Check, ExternalLink, FileSearch, LoaderCircle, Save, Settings2, X } from "lucide-react";
import type { ConsultationRequest, ConsultationSettings } from "@/lib/consultations/types";
import { consultationOfferings } from "@/lib/consultations/offerings";
import { formatConsultationAmount } from "@/lib/consultations/validation";

const statusLabels: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment", PAYMENT_SUBMITTED: "Payment review", PAYMENT_APPROVED: "Approved",
  PAYMENT_REJECTED: "Rejected", BOOKING_RELEASED: "Booking released", BOOKED: "Booked", CANCELLED: "Cancelled"
};

function time(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function ConsultationCalendarWorkspace({ settings, requests, upcoming }: { settings: ConsultationSettings | null; requests: ConsultationRequest[]; upcoming: ConsultationRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const pending = useMemo(() => requests.filter((item) => item.payment_status === "PAYMENT_SUBMITTED"), [requests]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("settings"); setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/consultations/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cashAppHandle: form.get("cashAppHandle"),
        paymentInstructions: form.get("paymentInstructions"),
        referenceInstructions: form.get("referenceInstructions"),
        firstTimeBookingUrl: form.get("firstTimeBookingUrl"),
        returningBookingUrl: form.get("returningBookingUrl"),
        isActive: form.get("isActive") === "on"
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(null); setMessage(response.ok ? "Consultation settings saved." : body.error ?? "Settings could not be saved.");
    if (response.ok) router.refresh();
  }

  async function review(id: string, decision: "APPROVE" | "REJECT") {
    setBusy(id); setMessage(null);
    const response = await fetch(`/api/consultations/${id}/review`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(decision === "APPROVE" ? { decision } : { decision, reason: reasons[id] ?? "" }) });
    const body = await response.json().catch(() => ({})) as { error?: string; notificationSent?: boolean };
    setBusy(null); setMessage(response.ok ? `${decision === "APPROVE" ? "Payment proof approved by owner and booking access released" : "Payment proof rejected"}.${body.notificationSent === false ? " The state was saved, but email delivery needs attention." : ""}` : body.error ?? "Review could not be saved.");
    if (response.ok) router.refresh();
  }

  return <div className="mx-auto max-w-6xl">
    <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Calendar</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Consultations, gated correctly.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Both paid services remain behind your manual payment-proof review. KYM Mail does not offer free meetings.</p></div><a href="/consult" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-3 text-sm font-semibold text-[#A73D52]">Open public page <ExternalLink className="size-4" /></a></header>
    {message && <p role="status" className="mt-6 rounded-2xl border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-4 text-sm text-[#8D2948]">{message}</p>}

    <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Consultation summary">
      <div className="rounded-3xl border border-[#E8E2E3] bg-white p-6"><p className="text-sm text-[#64748B]">Pending Payment Reviews</p><p className="mt-3 text-3xl font-semibold text-[#183A5A]">{pending.length}</p></div>
      <div className="rounded-3xl border border-[#E8E2E3] bg-white p-6"><p className="text-sm text-[#64748B]">Upcoming Consultations</p><p className="mt-3 text-3xl font-semibold text-[#183A5A]">{upcoming.length}</p></div>
      <div className="rounded-3xl border border-[#E8E2E3] bg-white p-6"><p className="text-sm text-[#64748B]">Provider</p><p className="mt-3 text-xl font-semibold text-[#183A5A]">Cal.com</p></div>
      <div className="rounded-3xl border border-[#E8E2E3] bg-white p-6"><p className="text-sm text-[#64748B]">Paid intake</p><p className="mt-3 text-xl font-semibold text-[#183A5A]">{settings?.is_active ? "Open" : "Closed"}</p></div>
    </section>

    <div className="mt-8 grid gap-8 xl:grid-cols-[1.2fr_.8fr]">
      <section className="rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Payment Review</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Manual proof decisions</h2>
        {pending.length ? <div className="mt-5 space-y-4">{pending.map((item) => <article key={item.id} className="rounded-2xl border border-[#E8E2E3] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-[#183A5A]">{item.client_name}</h3><p className="mt-1 break-all text-sm text-[#64748B]">{item.client_email}{item.client_phone ? ` · ${item.client_phone}` : ""}</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">{formatConsultationAmount(item.expected_amount_cents)}</span></div><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-[#7A8795]">Consultation</dt><dd className="font-medium text-[#183A5A]">{item.consultation_type}</dd></div><div><dt className="text-[#7A8795]">Submitted</dt><dd className="font-medium text-[#183A5A]">{time(item.created_at)}</dd></div></dl>{item.client_note && <p className="mt-4 rounded-xl bg-[#F8F5F4] p-3 text-sm leading-6 text-[#526173]">{item.client_note}</p>}<a href={`/api/consultations/${item.id}/proof`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#A73D52]"><FileSearch className="size-4" /> View private proof</a><label className="mt-4 block text-xs font-semibold text-[#526173]">Rejection reason<input value={reasons[item.id] ?? ""} onChange={(event) => setReasons((current) => ({ ...current, [item.id]: event.target.value }))} maxLength={500} placeholder="Required only when rejecting" className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#D95B72]" /></label><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy === item.id} onClick={() => review(item.id, "APPROVE")} className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy === item.id ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Approve payment</button><button disabled={busy === item.id || !(reasons[item.id]?.trim().length >= 3)} onClick={() => review(item.id, "REJECT")} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 disabled:opacity-40"><X className="size-4" /> Reject payment</button></div></article>)}</div> : <div className="mt-5 rounded-2xl bg-[#F8F5F4] p-5"><p className="text-sm font-semibold text-[#183A5A]">No pending submissions</p><p className="mt-1 text-sm text-[#64748B]">New payment proofs will appear here for manual review.</p></div>}
      </section>

      <div className="space-y-8"><section className="rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Upcoming Meetings</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Confirmed appointments</h2>{upcoming.length ? <div className="mt-5 space-y-3">{upcoming.map((item) => <article key={item.id} className="rounded-2xl border border-[#E8E2E3] p-4"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><CalendarCheck2 className="size-5" /></span><div className="min-w-0"><h3 className="truncate font-semibold text-[#183A5A]">{item.client_name}</h3><p className="mt-1 text-sm text-[#64748B]">{item.booking_start_at ? time(item.booking_start_at) : "Time pending"}</p><p className="mt-1 text-xs text-[#7A8795]">{item.consultation_type} · {item.booking_timezone}</p></div></div></article>)}</div> : <p className="mt-5 rounded-2xl bg-[#F8F5F4] p-5 text-sm text-[#64748B]">No upcoming meetings.</p>}</section>
        <section className="rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7"><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Paid Consultations</p><h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Recent requests</h2>{requests.length ? <div className="mt-5 space-y-3">{requests.slice(0, 8).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#EEE8E8] px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#183A5A]">{item.client_name}</p><p className="mt-0.5 truncate text-xs text-[#64748B]">{time(item.created_at)}</p></div><span className="shrink-0 rounded-full bg-[#F8F5F4] px-2.5 py-1 text-[10px] font-semibold text-[#526173]">{statusLabels[item.payment_status]}</span></div>)}</div> : <p className="mt-5 text-sm text-[#64748B]">No consultation requests yet.</p>}</section></div>
    </div>

    <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-[#FFF3F4] text-[#D95B72]"><Settings2 className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Booking Links</p><h2 className="text-xl font-semibold text-[#183A5A]">Consultation settings</h2></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-[#64748B]">Configure the two paid Cal.com events. Their fixed prices and durations are enforced by KYM Mail and cannot be edited here.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">{Object.values(consultationOfferings).map((offering) => <div key={offering.kind} className="rounded-2xl bg-[#F8F5F4] p-4"><p className="text-sm font-semibold text-[#183A5A]">{offering.name}</p><p className="mt-1 text-xs text-[#64748B]">{offering.durationMinutes} minutes · {formatConsultationAmount(offering.priceCents)}</p></div>)}</div>
      <form onSubmit={saveSettings} className="mt-6 grid gap-5 md:grid-cols-2"><label className="text-sm font-semibold text-[#183A5A]">Cash App handle<input name="cashAppHandle" required placeholder="$handle" defaultValue={settings?.cash_app_handle ?? ""} className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal" /></label><label className="flex items-center gap-3 self-end pb-3 text-sm font-semibold text-[#183A5A]"><input name="isActive" type="checkbox" defaultChecked={settings?.is_active ?? false} className="size-4 accent-[#D95B72]" /> Accept paid consultation submissions</label><label className="text-sm font-semibold text-[#183A5A] md:col-span-2">Payment instructions<textarea name="paymentInstructions" required minLength={10} maxLength={1000} rows={3} defaultValue={settings?.payment_instructions ?? ""} className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal" /></label><label className="text-sm font-semibold text-[#183A5A] md:col-span-2">Reference instructions <span className="font-normal text-[#7A8795]">(optional)</span><input name="referenceInstructions" maxLength={500} defaultValue={settings?.reference_instructions ?? ""} className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal" /></label><label className="text-sm font-semibold text-[#183A5A]">First-time consultation Cal.com URL<input name="firstTimeBookingUrl" required type="url" placeholder="https://cal.com/..." defaultValue={settings?.paid_booking_url ?? ""} className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal" /></label><label className="text-sm font-semibold text-[#183A5A]">Returning consultation Cal.com URL<input name="returningBookingUrl" required type="url" placeholder="https://cal.com/..." defaultValue={settings?.returning_booking_url ?? ""} className="mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal" /></label><div className="md:col-span-2 md:text-right"><button disabled={busy === "settings"} className="inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy === "settings" ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save settings</button></div></form>
    </section>
  </div>;
}
