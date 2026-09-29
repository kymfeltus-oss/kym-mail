"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";

export function PublicSessionForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/consultations/sessions", {
      method: "POST",
      body: form
    });
    const body = await response.json().catch(() => ({})) as { error?: string; bookingUrl?: string };
    if (!response.ok || !body.bookingUrl) {
      setBusy(false);
      return setError(body.error ?? "The 15-minute session could not be opened.");
    }
    window.location.assign(body.bookingUrl);
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
      <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">No account required</p>
      <h3 className="mt-1 text-xl font-semibold text-[#F4F7FB]">Open the 15-minute calendar</h3>
      <p className="mt-2 text-sm leading-6 text-[#93A0B5]">Enter your name and email. Scheduling opens immediately. You do not need to register or sign in.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#F4F7FB]">Name<input name="name" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]" /></label>
        <label className="text-sm font-semibold text-[#F4F7FB]">Email<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal outline-none focus:border-[#22D3EE] focus:ring-4 focus:ring-[#22D3EE]" /></label>
      </div>
      {error ? <p role="alert" className="mt-4 rounded-2xl bg-[#2A1218] px-4 py-3 text-sm text-[#FB7185]">{error}</p> : null}
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0E1C33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Opening calendar…</> : "Book 15-minute session"}</button>
    </form>
  );
}
