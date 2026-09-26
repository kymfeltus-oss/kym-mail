"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, LoaderCircle, Mail, RefreshCw, UserRound } from "lucide-react";
import { readApiJson } from "@/lib/http/read-api-json";
import type { ResumeTargetIntelligence } from "@/lib/resumes/target/intelligence";
import type { TargetResumeView } from "@/lib/resumes/target/types";

export function ResumeTargetIntelligencePanel({ target }: { target: TargetResumeView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function identify() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/resumes/targets/${target.id}/intelligence`, { method: "POST" });
      const payload = await readApiJson<ResumeTargetIntelligence & { error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "The hidden-employer analysis could not be completed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The hidden-employer analysis could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (target.intelligenceStatus === "NOT_RUN") void identify();
    // Identify once when this targeted resume first loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.id, target.intelligenceStatus]);

  const intelligence = target.intelligence;
  const company = intelligence?.identified_company;

  return (
    <section className="rounded-[2rem] border border-[#111111] bg-[#111111] p-5 text-[#F7F1E6] sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#C4A574]">Hidden employer</p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold"><Building2 className="size-6 text-[#C4A574]" /> Likely company and contacts</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#E8D9B8]">This stays on the Resume studio. Names and emails are shown only when a source-backed person and domain can be resolved. Estimated emails are pattern-derived, not invented people.</p>
        </div>
        <button type="button" onClick={() => void identify()} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#C4A574] px-4 text-sm font-semibold text-[#111111] disabled:opacity-60">
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {target.intelligenceStatus === "NOT_RUN" || busy ? "Identifying…" : "Re-run identification"}
        </button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-[#3A1C1C] p-3 text-sm text-[#F3C4C4]">{error}</p>}
      {target.intelligenceFailure && !error && <p role="alert" className="mt-4 rounded-2xl bg-[#3A1C1C] p-3 text-sm text-[#F3C4C4]">{target.intelligenceFailure}</p>}
      {company && intelligence && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-2xl bg-[#1B1B1B] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#C4A574]">Identified company</p>
            <p className="mt-2 text-2xl font-semibold">{company.company_name}</p>
            <p className="mt-1 text-sm text-[#C4A574]">{company.confidence_score_percentage}% confidence</p>
            <ul className="mt-4 space-y-2 text-sm leading-6 text-[#E8D9B8]">
              {company.matching_clues.map((clue) => <li key={clue}>{clue}</li>)}
            </ul>
          </article>
          <article className="rounded-2xl bg-[#1B1B1B] p-5">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#C4A574]">Primary contacts</p>
            {intelligence.primary_contacts.length ? intelligence.primary_contacts.map((contact) => (
              <div key={`${contact.full_name}:${contact.job_title}`} className="mt-4 border-t border-[#2C2C2C] pt-4 first:mt-3 first:border-t-0 first:pt-0">
                <p className="flex items-center gap-2 font-semibold"><UserRound className="size-4 text-[#C4A574]" />{contact.full_name}</p>
                <p className="mt-1 text-sm text-[#E8D9B8]">{contact.job_title}</p>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#C4A574]"><Mail className="size-4" />{contact.estimated_email}</p>
                {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold uppercase tracking-[.12em] text-[#E8D9B8] underline">LinkedIn</a>}
              </div>
            )) : <p className="mt-3 text-sm leading-6 text-[#E8D9B8]">No source-backed decision-makers were resolved. The brief stays anonymous until a real company record is identified.</p>}
          </article>
        </div>
      )}
      {intelligence && (
        <pre className="mt-5 overflow-x-auto rounded-2xl bg-[#0B0B0B] p-4 text-xs leading-6 text-[#E8D9B8]">{JSON.stringify(intelligence, null, 2)}</pre>
      )}
    </section>
  );
}
