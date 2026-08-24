"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, RotateCcw, XCircle } from "lucide-react";

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ScheduledMessageActions({ id, status, version, scheduledFor }: { id: string; status: string; version: number; scheduledFor: string }) {
  const router = useRouter();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(() => localInputValue(new Date(scheduledFor)));
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function mutate(payload: Record<string, unknown>) {
    setWorking(true); setError(null);
    try {
      const response = await fetch(`/api/scheduled/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...payload, version }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The schedule could not be changed.");
      router.refresh(); setRescheduleOpen(false); setCancelOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The schedule could not be changed.");
    } finally { setWorking(false); }
  }

  if (status !== "SCHEDULED" && status !== "FAILED") return null;
  return <section className="mt-7 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 sm:p-6">
    <div className="flex flex-wrap gap-3">
      {status === "SCHEDULED" && <><button type="button" onClick={() => setRescheduleOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-[#E7B8C1] px-4 py-2 text-sm font-semibold text-[#A73D52]"><CalendarClock className="size-4" /> Reschedule</button><button type="button" onClick={() => setCancelOpen(true)} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] px-4 py-2 text-sm font-semibold text-[#64748B]"><XCircle className="size-4" /> Cancel</button></>}
      {status === "FAILED" && <button type="button" onClick={() => void mutate({ action: "retry" })} disabled={working} className="inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><RotateCcw className="size-4" /> Retry delivery</button>}
    </div>
    {rescheduleOpen && <div className="mt-5 rounded-2xl bg-[#FFF3F4] p-4"><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">New date and time<input type="datetime-local" value={scheduledLocal} min={localInputValue(new Date(Date.now() + 60_000))} onChange={(event) => setScheduledLocal(event.target.value)} className="w-full rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal" /></label><p className="mt-2 text-xs text-[#64748B]">Timezone: {timezone}</p><button type="button" disabled={working} onClick={() => void mutate({ action: "reschedule", scheduledFor: new Date(scheduledLocal).toISOString(), timezone })} className="mt-4 rounded-full bg-[#D95B72] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{working ? "Saving…" : "Save new time"}</button></div>}
    {cancelOpen && <div role="alertdialog" aria-label="Confirm cancellation" className="mt-5 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] p-4"><p className="text-sm font-semibold text-[#183A5A]">Cancel this scheduled email?</p><p className="mt-1 text-sm leading-6 text-[#64748B]">It will remain in history and will never be eligible for delivery.</p><div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={working} onClick={() => void mutate({ action: "cancel" })} className="rounded-full bg-[#A73D52] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">Confirm cancellation</button><button type="button" onClick={() => setCancelOpen(false)} className="rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-5 py-2.5 text-sm font-semibold text-[#64748B]">Keep scheduled</button></div></div>}
    {error && <p role="alert" className="mt-4 rounded-xl bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">{error}</p>}
  </section>;
}
