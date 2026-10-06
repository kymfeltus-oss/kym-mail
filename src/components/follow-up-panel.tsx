"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { followUpOneTemplate, followUpTwoTemplate, outreachTimeZones } from "@/lib/mail/follow-up";
import { readApiJson } from "@/lib/http/read-api-json";

export function FollowUpPanel({ threadIds, smsConfigured, onClear }: { threadIds: string[]; smsConfigured: boolean; onClear: () => void }) {
  const router = useRouter();
  const [timezone, setTimezone] = useState("America/Chicago");
  const [companyName, setCompanyName] = useState("");
  const [followUpOne, setFollowUpOne] = useState(followUpOneTemplate);
  const [followUpTwo, setFollowUpTwo] = useState(followUpTwoTemplate);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function applySequence() {
    setStatus("saving");
    setMessage(null);
    try {
      const response = await fetch("/api/mail/follow-ups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ threadIds, timezone, companyName, followUpOne, followUpTwo })
      });
      const payload = await readApiJson<{ error?: string; started?: number; skipped?: Array<{ reason: string }> }>(response);
      if (!response.ok || !payload.started) {
        setStatus("error");
        setMessage(payload.error || payload.skipped?.[0]?.reason || "The follow-up sequence could not be started.");
        return;
      }
      const skipped = payload.skipped?.length ? ` ${payload.skipped.length} could not be added.` : "";
      setStatus("idle");
      setMessage(`Follow-up sequence started for ${payload.started} conversation${payload.started === 1 ? "" : "s"}.${skipped}`);
      onClear();
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("The follow-up sequence could not be started.");
    }
  }

  return <section className="mb-4 rounded-3xl border border-[#1D4E89] bg-[#101828] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#22D3EE]">Selected mail</p>
        <h2 className="mt-1 text-lg font-semibold text-[#F4F7FB]">Follow-up sequence</h2>
      </div>
      <p className="text-sm font-semibold text-[#67E8F9]">{threadIds.length} selected</p>
    </div>
    <ul className="mt-4 space-y-1 text-sm leading-6 text-[#93A0B5]">
      <li>Wait at least 4 business days, then send on Tuesday, Wednesday, or Thursday between 9:30 and 11:30 a.m. in the company time zone.</li>
      <li>One original note plus two replies in the same thread. A real reply, a bounce, or Do not contact stops the sequence.</li>
      <li>{smsConfigured ? "A live reply texts your phone. Out-of-office notes, bounces, and unsubscribe requests do not." : "Text alerts stay off until Twilio is configured. A real reply, a bounce, or an unsubscribe request still stops the sequence."}</li>
    </ul>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2 text-sm font-semibold text-[#F4F7FB]">Company time zone
        <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="rounded-xl border border-[#1C283C] bg-[#0B1220] px-3 py-3 font-normal text-[#F4F7FB]">
          {outreachTimeZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[#F4F7FB]">Company name for the text alert
        <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Optional" className="rounded-xl border border-[#1C283C] bg-[#0B1220] px-3 py-3 font-normal text-[#F4F7FB] outline-none placeholder:text-[#93A0B5]" />
      </label>
    </div>
    <label className="mt-3 grid gap-2 text-sm font-semibold text-[#F4F7FB]">Follow-up 1, the short bump
      <textarea value={followUpOne} onChange={(event) => setFollowUpOne(event.target.value)} rows={5} className="rounded-xl border border-[#1C283C] bg-[#0B1220] px-3 py-3 font-normal leading-6 text-[#F4F7FB] outline-none" />
    </label>
    <label className="mt-3 grid gap-2 text-sm font-semibold text-[#F4F7FB]">Follow-up 2, the last note
      <textarea value={followUpTwo} onChange={(event) => setFollowUpTwo(event.target.value)} rows={6} className="rounded-xl border border-[#1C283C] bg-[#0B1220] px-3 py-3 font-normal leading-6 text-[#F4F7FB] outline-none" />
    </label>
    <p className="mt-2 text-xs text-[#93A0B5]">[Name] is replaced with the recipient name from their email address.</p>
    {message && <p role="status" className={`mt-3 text-sm ${status === "error" ? "text-[#F4B4C4]" : "text-[#67E8F9]"}`}>{message}</p>}
    <div className="mt-4 flex flex-wrap gap-3">
      <button type="button" disabled={status === "saving"} onClick={() => void applySequence()} className="rounded-full kym-action px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{status === "saving" ? "Starting…" : "Start follow-up sequence"}</button>
      <button type="button" onClick={onClear} className="rounded-full border border-[#1C283C] px-5 py-3 text-sm font-semibold text-[#93A0B5]">Clear selection</button>
    </div>
  </section>;
}
