"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { readApiJson } from "@/lib/http/read-api-json";
import { formatScheduledTimestamp } from "@/lib/mail/date-format";

export type OutreachSequenceItem = {
  id: string;
  recipient_email: string;
  recipient_name: string;
  company_name: string;
  subject: string;
  timezone: string;
  sequence_stage: number;
  lead_status: string;
  next_action_at: string | null;
  status: string;
};

const leadLabels: Record<string, string> = {
  sent: "Sent",
  opened: "Opened",
  replied: "Replied",
  bounced: "Bounced",
  do_not_contact: "Do not contact",
  passive: "Passive"
};

export function OutreachSequenceList({ sequences }: { sequences: OutreachSequenceItem[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (!sequences.length) return null;

  async function stop(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(`/api/mail/follow-ups/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "do_not_contact" }) });
      const payload = await readApiJson<{ error?: string }>(response);
      if (!response.ok) {
        setError(payload.error || "The sequence could not be stopped.");
        setBusyId(null);
        return;
      }
      setBusyId(null);
      router.refresh();
    } catch {
      setBusyId(null);
      setError("The sequence could not be stopped.");
    }
  }

  return <section className="mt-10">
    <h2 className="text-xl font-semibold text-[#F4F7FB]">Follow-up sequences</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-[#93A0B5]">Each selected conversation gets the original note plus two replies in the same thread. A live reply sends a text and ends the sequence.</p>
    {error && <p role="alert" className="mt-3 text-sm text-[#F4B4C4]">{error}</p>}
    <div className="mt-4 space-y-3">{sequences.map((sequence) => <article key={sequence.id} className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#122033] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#67E8F9]">{leadLabels[sequence.lead_status] ?? sequence.lead_status}</span>
            <span className="text-xs font-semibold uppercase tracking-[.1em] text-[#93A0B5]">Touch {sequence.sequence_stage} of 3</span>
          </div>
          <h3 className="mt-3 truncate text-lg font-semibold text-[#F4F7FB]">{sequence.subject}</h3>
          <p className="mt-1 truncate text-sm text-[#93A0B5]">To: {sequence.recipient_name ? `${sequence.recipient_name} · ` : ""}{sequence.recipient_email}{sequence.company_name ? ` · ${sequence.company_name}` : ""}</p>
        </div>
        <div className="text-right">
          {sequence.next_action_at && sequence.status === "active" ? <time className="block text-sm font-semibold text-[#F4F7FB]" dateTime={sequence.next_action_at}>{formatScheduledTimestamp(sequence.next_action_at, sequence.timezone)}</time> : <p className="text-sm text-[#93A0B5]">{sequence.status}</p>}
          {sequence.status === "active" && <button type="button" disabled={busyId === sequence.id} onClick={() => void stop(sequence.id)} className="mt-3 rounded-full border border-[#1C283C] px-4 py-2 text-xs font-semibold text-[#F4F7FB] disabled:opacity-60">{busyId === sequence.id ? "Stopping…" : "Do not contact"}</button>}
        </div>
      </div>
    </article>)}</div>
  </section>;
}
