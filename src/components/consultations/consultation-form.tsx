"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { consultationOffering, consultationKinds, type ConsultationKind } from "@/lib/consultations/offerings";
import { formatConsultationAmount } from "@/lib/consultations/validation";

export function ConsultationForm({ client, initialKind = "FIRST_TIME" }: { client?: { name: string; email: string } | null; initialKind?: ConsultationKind }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<ConsultationKind>(initialKind);
  const selected = consultationOffering(kind);
  const returningLocked = kind === "RETURNING" && !client;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (returningLocked) return;
    setBusy(true); setError(null);
    const response = await fetch("/api/consultations", { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json().catch(() => ({})) as { error?: string; statusUrl?: string };
    setBusy(false);
    if (!response.ok || !body.statusUrl) return setError(body.error ?? "The request could not be submitted.");
    setStatusUrl(body.statusUrl);
  }

  if (statusUrl) return <div className="rounded-3xl border border-[#14523A] bg-[#0C241C] p-6 sm:p-8"><CheckCircle2 className="size-9 text-[#34D399]" /><h3 className="mt-5 text-xl font-semibold text-[#F4F7FB]">Payment proof received</h3><p className="mt-2 text-sm leading-6 text-[#93A0B5]">Your proof is pending manual owner review. No booking access has been released yet.</p><a href={statusUrl} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0E1C33] px-5 py-3 text-sm font-semibold text-white">View request status <ArrowRight className="size-4" /></a></div>;

  return <form onSubmit={submit} className="min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_20px_60px_rgba(0,0,0,.08)] sm:p-8">
    <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <fieldset><legend className="text-sm font-semibold text-[#F4F7FB]">Consultation type</legend><div className="mt-2 grid gap-3 sm:grid-cols-2">{consultationKinds.map((optionKind) => { const offering = consultationOffering(optionKind); return <label key={optionKind} className={`cursor-pointer rounded-2xl border p-4 transition ${kind === optionKind ? "border-[#22D3EE] bg-[#122033] ring-2 ring-[#22D3EE]" : "border-[#243044]"}`}><input className="sr-only" type="radio" name="consultationKind" value={optionKind} checked={kind === optionKind} onChange={() => setKind(optionKind)} /><span className="block text-sm font-semibold text-[#F4F7FB]">{offering.name}</span><span className="mt-1 block text-xs text-[#93A0B5]">{offering.durationMinutes} minutes · {formatConsultationAmount(offering.priceCents)} · {optionKind === "FIRST_TIME" ? "No login" : "Login required"}</span></label>; })}</div><p className="mt-2 text-xs leading-5 text-[#93A0B5]">The 1 Hour Consultation requires a client login. The first-time consultation does not.</p></fieldset>
    <div className="mt-6 rounded-2xl bg-[#05070D] px-4 py-3 text-sm text-[#93A0B5]">Selected: <strong className="text-[#F4F7FB]">{selected.name} · {formatConsultationAmount(selected.priceCents)}</strong></div>
    {returningLocked ? <div className="mt-6 rounded-2xl border border-[#1D4E89] bg-[#122033] p-5"><p className="text-sm font-semibold text-[#F4F7FB]">Log in to book the 1 Hour Consultation.</p><p className="mt-2 text-sm leading-6 text-[#93A0B5]">The first-time consultation stays open without an account.</p><Link href="/#account" className="mt-4 inline-flex rounded-full bg-[#0E1C33] px-5 py-3 text-sm font-semibold text-white">Log in or create account</Link></div> : <div key={kind} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-[#F4F7FB]">Name<input name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={kind === "RETURNING" ? client?.name : undefined} readOnly={kind === "RETURNING"} className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none transition focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE] read-only:bg-[#05070D]" /></label>
      <label className="text-sm font-semibold text-[#F4F7FB]">Email<input name="email" required type="email" maxLength={254} autoComplete="email" defaultValue={kind === "RETURNING" ? client?.email : undefined} readOnly={kind === "RETURNING"} className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none transition focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE] read-only:bg-[#05070D]" /></label>
      <label className="text-sm font-semibold text-[#F4F7FB] sm:col-span-2">Phone <span className="font-normal text-[#93A0B5]">(optional)</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none transition focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]" /></label>
      <label className="text-sm font-semibold text-[#F4F7FB] sm:col-span-2">Note <span className="font-normal text-[#93A0B5]">(optional)</span><textarea name="note" maxLength={1000} rows={4} className="mt-2 w-full resize-y rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none transition focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]" /></label>
      <label className="group sm:col-span-2"><span className="text-sm font-semibold text-[#F4F7FB]">Payment proof</span><span className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#1D4E89] bg-[#122033] p-5 text-center transition group-focus-within:ring-4 group-focus-within:ring-[#22D3EE]"><FileUp className="size-7 text-[#22D3EE]" /><span className="mt-2 text-sm font-semibold text-[#F4F7FB]">Upload PNG, JPG, JPEG, or PDF</span><span className="mt-1 text-xs text-[#93A0B5]">Maximum 8 MB · stored privately</span><input name="paymentProof" required type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" className="mt-3 block w-full min-w-0 max-w-full text-xs text-[#93A0B5] file:mr-3 file:rounded-full file:border-0 file:bg-[#0E1C33] file:px-4 file:py-2 file:font-semibold file:text-white" /></span></label>
    </div>}
    {error && <p role="alert" className="mt-5 rounded-2xl bg-[#2A1218] px-4 py-3 text-sm text-[#FB7185]">{error}</p>}
    {returningLocked ? null : <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full kym-action px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.22)] disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Submitting securely…</> : <><ShieldCheck className="size-4" /> Submit for owner review</>}</button>}
    <p className="mt-4 text-center text-xs leading-5 text-[#93A0B5]">{kind === "FIRST_TIME" ? "No account is required. Submitting proof does not confirm payment or release scheduling access." : "This consultation uses your client login. Submitting proof does not confirm payment or release scheduling access."}</p>
  </form>;
}
