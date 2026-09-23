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
    <form onSubmit={submit} className="rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
      <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Existing-client session</p>
      <h2 className="mt-1 text-xl font-semibold text-[#183A5A]">Book a 15-minute meeting</h2>
      <p className="mt-2 text-sm leading-6 text-[#64748B]">No consultation fee. Confirm your client number to open the private scheduling calendar.</p>
      <label className="mt-5 block text-sm font-semibold text-[#183A5A]">Client number<input name="clientNumber" required defaultValue={clientNumber} className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal uppercase outline-none focus:border-[#D95B72]" /></label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Opening calendar…</> : "Book 15-minute session"}</button>
    </form>
  );
}
