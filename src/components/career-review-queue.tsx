"use client";

import { useState } from "react";
import { Check, LoaderCircle, PencilLine, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";

export type CareerReviewCandidate = {
  id: string;
  group_key: string;
  entity_type: string;
  field_name: string;
  career_fact_id: string | null;
  normalized_claim: string;
  extracted_value: unknown;
  source_reference: string;
  classification: "SUPPORTED_BY_BOTH" | "SUPPORTED_BY_RESUME_A" | "SUPPORTED_BY_RESUME_B" | "POTENTIAL_CONFLICT";
  status: "CONFIRMED" | "NEEDS_REVIEW" | "CONFLICT" | "REJECTED";
  review_reason: string | null;
  career_sources: { label: string; intake_identity: "RESUME_A" | "RESUME_B" | "OWNER_STATEMENT" | null } | null;
};

export type CareerReviewAuthoritativeFact = {
  groupKey: string;
  value: unknown;
  confirmationMethod: string | null;
  sources: Array<{ label: string; identity: string | null; reference: string }>;
};

function displayClaim(candidate: CareerReviewCandidate) {
  if (typeof candidate.extracted_value === "string") return candidate.extracted_value;
  if (candidate.extracted_value && typeof candidate.extracted_value === "object") {
    const record = candidate.extracted_value as Record<string, unknown>;
    if (typeof record.sourceWording === "string") return record.sourceWording;
    if (typeof record.ownerConfirmedClaim === "string") return record.ownerConfirmedClaim;
  }
  return candidate.normalized_claim;
}

function displayValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.ownerConfirmedClaim === "string") return record.ownerConfirmedClaim;
    if (typeof record.sourceWording === "string") return record.sourceWording;
  }
  return JSON.stringify(value);
}

function careerItemLabel(candidate: CareerReviewCandidate) {
  const field = candidate.field_name.replaceAll("_", " ");
  const entity = candidate.entity_type.charAt(0) + candidate.entity_type.slice(1).toLowerCase();
  return `${entity} · ${field}`;
}

export function CareerReviewQueue({ candidates, authoritativeFacts }: { candidates: CareerReviewCandidate[]; authoritativeFacts: CareerReviewAuthoritativeFact[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const groups = Map.groupBy(candidates, (candidate) => candidate.group_key);
  const authoritativeByGroup = new Map(authoritativeFacts.map((fact) => [fact.groupKey, fact]));

  async function resolve(candidate: CareerReviewCandidate, action: "APPROVE" | "EDIT" | "REJECT") {
    setPending(candidate.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/career/review/${candidate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "EDIT" ? { editedClaim: editValue } : {}) })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The review item could not be saved.");
      setEditing(null);
      setMessage(action === "REJECT" ? "Candidate rejected." : "Owner-confirmed fact saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The review item could not be saved.");
    } finally {
      setPending(null);
    }
  }

  if (candidates.length === 0) return <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900"><p className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5" />No exceptions need review.</p><p className="mt-2 leading-6 text-emerald-800/80">Exact low-risk agreements are confirmed automatically. Material and ambiguous claims remain here until the owner decides.</p></div>;

  return <div className="space-y-4">
    {Array.from(groups.entries()).map(([groupKey, facts]) => { const reviewFact = facts.find((fact) => fact.status === "NEEDS_REVIEW" || fact.status === "CONFLICT")!; const identities = new Set(facts.map((fact) => fact.career_sources?.intake_identity)); const authoritative = authoritativeByGroup.get(groupKey); return <article key={groupKey} className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_12px_36px_rgba(24,58,90,.05)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#D95B72]">{facts.some((fact) => fact.status === "CONFLICT") ? "Potential conflict" : "Unique source claim"}</p><h3 className="mt-2 font-semibold text-[#183A5A]">{careerItemLabel(reviewFact)}</h3><p className="mt-2 text-sm leading-6 text-[#52657A]">{reviewFact.review_reason}</p></div><span className="rounded-full bg-[#FFF3F4] px-3 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#A73D52]">{reviewFact.classification.replaceAll("_", " ")}</span></div>
      {authoritative && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-emerald-800">Current authoritative value</p><p className="mt-2 break-words text-sm font-semibold leading-6 text-[#183A5A]">{displayValue(authoritative.value)}</p><p className="mt-2 text-xs text-emerald-900/70">{authoritative.confirmationMethod?.replaceAll("_", " ").toLowerCase() ?? "Confirmed"}{authoritative.sources.length > 0 ? ` · ${authoritative.sources.map((source) => source.label).join(", ")}` : ""}</p></div>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">{(["RESUME_A", "RESUME_B"] as const).filter((identity) => !identities.has(identity)).map((identity) => <div key={identity} className="min-w-0 rounded-2xl border border-dashed border-[#D9D1D3] bg-[#FAF7F7] p-4"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#8A6A71]">{identity.replace("RESUME_", "Resume ")}</p><p className="mt-2 text-sm text-[#64748B]">No matching claim in this source.</p></div>)}{facts.map((candidate) => <div key={candidate.id} className="min-w-0 rounded-2xl border border-[#E8E2E3] bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#A73D52]">{candidate.career_sources?.intake_identity?.replace("RESUME_", "Resume ") ?? candidate.career_sources?.label ?? "Source"}</p>
        <p className="mt-2 break-words text-sm font-semibold leading-6 text-[#183A5A]">{displayClaim(candidate)}</p>
        <p className="mt-2 text-xs text-[#64748B]">{candidate.source_reference}</p>
        {candidate.status === "CONFIRMED" ? <div className="mt-4 flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><ShieldCheck className="size-3.5" />Current authoritative value</span>{reviewFact.status === "CONFLICT" && <button type="button" disabled={pending === reviewFact.id} onClick={() => resolve(reviewFact, "REJECT")} className="rounded-full bg-[#183A5A] px-4 py-2 text-xs font-semibold text-white">Keep {candidate.career_sources?.intake_identity === "RESUME_A" ? "A" : "current value"}</button>}</div>
          : editing === candidate.id ? <div className="mt-4"><label htmlFor={`candidate-edit-${candidate.id}`} className="text-xs font-semibold uppercase tracking-[.08em] text-[#52657A]">Corrected authoritative fact</label><textarea id={`candidate-edit-${candidate.id}`} value={editValue} onChange={(event) => setEditValue(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-[#D9D1D3] px-4 py-3 text-sm leading-6 text-[#183A5A] outline-none focus:border-[#D95B72]" /><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={pending === candidate.id} onClick={() => resolve(candidate, "EDIT")} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-4 py-2 text-xs font-semibold text-white">{pending === candidate.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Save correction</button><button type="button" onClick={() => setEditing(null)} className="rounded-full border border-[#D9D1D3] px-4 py-2 text-xs font-semibold text-[#52657A]">Cancel</button></div></div>
          : <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={pending === candidate.id} onClick={() => resolve(candidate, "APPROVE")} className="inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">{pending === candidate.id ? <LoaderCircle className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}Approve {candidate.career_sources?.intake_identity === "RESUME_A" ? "A" : candidate.career_sources?.intake_identity === "RESUME_B" ? "B" : "claim"}</button><button type="button" onClick={() => { setEditing(candidate.id); setEditValue(displayClaim(candidate)); }} className="inline-flex items-center gap-2 rounded-full border border-[#E8B8C0] px-4 py-2 text-xs font-semibold text-[#A73D52]"><PencilLine className="size-3.5" />Edit</button><button type="button" disabled={pending === candidate.id} onClick={() => resolve(candidate, "REJECT")} className="inline-flex items-center gap-2 rounded-full border border-[#D9D1D3] px-4 py-2 text-xs font-semibold text-[#52657A]"><X className="size-3.5" />Reject</button></div>}
      </div>)}</div>
    </article>; })}
    {message && <p className="rounded-2xl bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]" role="status">{message}</p>}
  </div>;
}
