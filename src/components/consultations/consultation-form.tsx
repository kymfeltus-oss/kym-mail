"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, FileUp, LoaderCircle, ShieldCheck } from "lucide-react";

export function ConsultationForm({ consultationName }: { consultationName: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusUrl, setStatusUrl] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const response = await fetch("/api/consultations", { method: "POST", body: new FormData(event.currentTarget) });
    const body = await response.json().catch(() => ({})) as { error?: string; statusUrl?: string };
    setBusy(false);
    if (!response.ok || !body.statusUrl) return setError(body.error ?? "The request could not be submitted.");
    setStatusUrl(body.statusUrl);
  }

  if (statusUrl) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 sm:p-8">
    <CheckCircle2 className="size-9 text-emerald-700" />
    <h3 className="mt-5 text-xl font-semibold text-[#183A5A]">Payment proof received</h3>
    <p className="mt-2 text-sm leading-6 text-[#526173]">Your proof is pending manual owner review. No booking access has been released yet.</p>
    <a href={statusUrl} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white">View request status <ArrowRight className="size-4" /></a>
  </div>;

  return <form onSubmit={submit} className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-white p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-8">
    <input type="hidden" name="consultationType" value={consultationName} />
    <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-semibold text-[#183A5A]">Name<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none transition focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      <label className="text-sm font-semibold text-[#183A5A]">Email<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none transition focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      <label className="text-sm font-semibold text-[#183A5A] sm:col-span-2">Phone <span className="font-normal text-[#7A8795]">(optional)</span><input name="phone" type="tel" maxLength={30} autoComplete="tel" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none transition focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      <label className="text-sm font-semibold text-[#183A5A] sm:col-span-2">Note <span className="font-normal text-[#7A8795]">(optional)</span><textarea name="note" maxLength={1000} rows={4} className="mt-2 w-full resize-y rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none transition focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      <label className="group sm:col-span-2">
        <span className="text-sm font-semibold text-[#183A5A]">Payment proof</span>
        <span className="mt-2 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9A7B1] bg-[#FFF7F8] p-5 text-center transition group-focus-within:ring-4 group-focus-within:ring-[#F7DDE1]">
          <FileUp className="size-7 text-[#D95B72]" /><span className="mt-2 text-sm font-semibold text-[#183A5A]">Upload PNG, JPG, JPEG, or PDF</span><span className="mt-1 text-xs text-[#64748B]">Maximum 8 MB · stored privately</span>
          <input name="paymentProof" required type="file" accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf" className="mt-3 block w-full min-w-0 max-w-full text-xs text-[#64748B] file:mr-3 file:rounded-full file:border-0 file:bg-[#183A5A] file:px-4 file:py-2 file:font-semibold file:text-white" />
        </span>
      </label>
    </div>
    {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Submitting securely…</> : <><ShieldCheck className="size-4" /> Submit for owner review</>}</button>
    <p className="mt-4 text-center text-xs leading-5 text-[#7A8795]">Submitting proof does not confirm payment or release scheduling access.</p>
  </form>;
}
