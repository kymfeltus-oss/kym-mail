"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

const types = [
  "PROFESSIONAL_IDENTITY", "EXPERIENCE_CONTEXT", "ACCOMPLISHMENT", "FINANCE_CAPABILITY",
  "ACCOUNTING_CAPABILITY", "TECHNOLOGY", "SYSTEM", "EDUCATION", "CREDENTIAL", "PROJECT"
] as const;

export function CareerAddFact() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [factType, setFactType] = useState<(typeof types)[number]>("ACCOMPLISHMENT");
  const [claim, setClaim] = useState("");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/career/facts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ factType, claim, ...(reason.trim() ? { reason } : {}) }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The fact could not be added.");
      setClaim("");
      setReason("");
      setMessage("Added as owner-confirmed evidence.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The fact could not be added.");
    } finally {
      setPending(false);
    }
  }

  return <div><button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-full border border-[#E8B8C0] bg-white px-4 py-2 text-xs font-semibold text-[#A73D52]"><Plus className="size-4" />Add owner fact</button>{open && <form onSubmit={submit} className="mt-4 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5"><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-xs font-semibold uppercase tracking-[.08em] text-[#52657A]">Fact category</span><select value={factType} onChange={(event) => setFactType(event.target.value as typeof factType)} className="mt-2 w-full rounded-2xl border border-[#D9D1D3] bg-white px-4 py-3 text-sm text-[#183A5A]">{types.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="block"><span className="text-xs font-semibold uppercase tracking-[.08em] text-[#52657A]">Reason or context (optional)</span><input value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#D9D1D3] bg-white px-4 py-3 text-sm text-[#183A5A]" /></label><label className="block sm:col-span-2"><span className="text-xs font-semibold uppercase tracking-[.08em] text-[#52657A]">Authoritative fact</span><textarea required minLength={2} maxLength={2000} rows={4} value={claim} onChange={(event) => setClaim(event.target.value)} className="mt-2 w-full rounded-2xl border border-[#D9D1D3] bg-white px-4 py-3 text-sm leading-6 text-[#183A5A]" /></label></div><div className="mt-4 flex items-center gap-3"><button disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}Add fact</button>{message && <p className="text-sm text-[#A73D52]" role="status">{message}</p>}</div></form>}</div>;
}
