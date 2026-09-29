"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";

export function ClientBookingForm({ clientNumber }: { clientNumber: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/clients/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ clientNumber: form.get("clientNumber") })
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
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Existing-client session</p>
      <h2 className="mt-1 text-xl font-semibold text-[#F4F7FB]">Book a 15-minute meeting</h2>
      <p className="mt-2 text-sm leading-6 text-[#93A0B5]">No consultation fee. Confirm your client number to open the private scheduling calendar.</p>
      <label className="mt-5 block text-sm font-semibold text-[#F4F7FB]">Client number<input name="clientNumber" required defaultValue={clientNumber} className="mt-2 w-full rounded-2xl border border-[#243044] px-4 py-3 font-normal uppercase outline-none focus:border-[#22D3EE]" /></label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-[#2A1218] px-4 py-3 text-sm text-[#FB7185]">{error}</p>}
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#0E1C33] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Opening calendar…</> : "Book 15-minute session"}</button>
    </form>
  );
}
