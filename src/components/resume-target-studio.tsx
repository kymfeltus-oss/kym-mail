"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleHelp, LoaderCircle, Sparkles, X } from "lucide-react";
import { ResumeLayoutGallery } from "@/components/resume-layout-gallery";
import { ResumeProjectEditor, type ResumeProjectChoice } from "@/components/resume-project-editor";
import { ResumeTargetIntelligencePanel } from "@/components/resume-target-intelligence";
import { readApiJson } from "@/lib/http/read-api-json";
import type { TargetResumeView } from "@/lib/resumes/target/types";

const stateLabel: Record<TargetResumeView["requirements"][number]["matchState"], string> = {
  STRONG_MATCH: "Strong match",
  MATCH: "Match",
  PARTIAL_MATCH: "Partial",
  NO_MATCH: "No match",
  UNVERIFIED: "Unverified",
  NOT_APPLICABLE: "Not applicable"
};

export function ResumeTargetStudio({ target, projectCatalog = [] }: { target: TargetResumeView; projectCatalog?: ResumeProjectChoice[] }) {
  const router = useRouter();
  const pending = useMemo(() => target.requirements.filter((item) => item.needsConfirmation), [target.requirements]);
  const matched = useMemo(() => target.requirements.filter((item) => item.matchState === "STRONG_MATCH" || item.matchState === "MATCH"), [target.requirements]);
  const saved = useMemo(() => Object.fromEntries(target.confirmations.map((item) => [item.requirementId, item])), [target.confirmations]);
  const [answers, setAnswers] = useState<Record<string, { answer: "YES" | "NO" | ""; promptText: string }>>(() => (
    Object.fromEntries(pending.map((item) => [item.id, { answer: saved[item.id]?.answer ?? "", promptText: saved[item.id]?.promptText ?? "" }]))
  ));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = pending.filter((item) => answers[item.id]?.answer !== "YES" && answers[item.id]?.answer !== "NO");

  async function saveConfirmations() {
    const confirmations = pending.map((item) => ({
      requirementId: item.id,
      answer: answers[item.id]?.answer,
      promptText: ""
    }));
    if (confirmations.some((item) => item.answer !== "YES" && item.answer !== "NO")) throw new Error("Confirm whether you have each unmatched requirement.");
    const response = await fetch(`/api/resumes/targets/${target.id}/confirmations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmations })
    });
    const payload = await readApiJson<{ error?: string }>(response);
    if (!response.ok) throw new Error(payload.error ?? "Your confirmations could not be saved.");
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await saveConfirmations();
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your confirmations could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      await saveConfirmations();
      const response = await fetch(`/api/resumes/targets/${target.id}/generate`, { method: "POST" });
      const payload = await readApiJson<{ error?: string }>(response);
      if (!response.ok) throw new Error(payload.error ?? "The targeted resume could not be written.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The targeted resume could not be written.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8 space-y-8">
      {error && <p role="alert" className="rounded-2xl bg-[#2A1218] p-3 text-sm text-[#67E8F9]">{error}</p>}
      {target.failureMessage && <p role="alert" className="rounded-2xl bg-[#2A1218] p-3 text-sm text-[#67E8F9]">{target.failureMessage}</p>}
      <ResumeTargetIntelligencePanel target={target} />

      <section className="rounded-[2rem] border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Already on the page</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#F4F7FB]">Matched to your Career Profile</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#93A0B5]">These requirements already have confirmed evidence. They will be elevated in this version.</p>
        <div className="mt-5 space-y-3">
          {matched.length ? matched.map((item) => (
            <article key={item.id} className="rounded-2xl border border-[#14523A] bg-[#0C241C] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#34D399]">{stateLabel[item.matchState]} · {item.category.toLowerCase()}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#F4F7FB]">{item.originalText}</p>
              {item.matchedEvidence[0] && <p className="mt-2 text-xs leading-5 text-[#93A0B5]">{item.matchedEvidence[0].label}: {item.matchedEvidence[0].excerpt}</p>}
            </article>
          )) : <p className="text-sm text-[#93A0B5]">No confirmed matches were found. Confirm the gaps below so this version stays honest.</p>}
        </div>
      </section>

      <section className="rounded-[2rem] border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Your call</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#F4F7FB]">Mandatory qualifications</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#93A0B5]">Only required qualifications that your accounting career does not already cover are listed here. Operations and corporate accounting are assumed from your roles. Your answer stays off the résumé.</p>
        <div className="mt-6 space-y-4">
          {pending.length ? pending.map((item) => {
            const current = answers[item.id] ?? { answer: "", promptText: "" };
            return (
              <article key={item.id} className="rounded-2xl border border-[#1C283C] bg-[#101828] p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#22D3EE]">{stateLabel[item.matchState]} · {item.importance.toLowerCase()}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#F4F7FB]">{item.originalText}</p>
                <p className="mt-2 text-xs leading-5 text-[#93A0B5]">{item.explanation}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setAnswers((value) => ({ ...value, [item.id]: { ...current, answer: "YES" } }))} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${current.answer === "YES" ? "bg-[#05070D] text-[#F4F7FB]" : "border border-[#1C283C] text-[#F4F7FB]"}`}><Check className="size-4" /> I have this</button>
                  <button type="button" onClick={() => setAnswers((value) => ({ ...value, [item.id]: { answer: "NO", promptText: "" } }))} className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold ${current.answer === "NO" ? "kym-action text-white" : "border border-[#1C283C] text-[#F4F7FB]"}`}><X className="size-4" /> I do not</button>
                </div>
              </article>
            );
          }) : <p className="flex items-center gap-2 text-sm text-[#34D399]"><CircleHelp className="size-4" />Nothing needs confirmation. Generate the targeted version.</p>}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => void save()} disabled={Boolean(busy) || Boolean(remaining.length)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#1C283C] px-5 text-sm font-semibold text-[#F4F7FB] disabled:opacity-50">{busy === "save" ? <LoaderCircle className="size-4 animate-spin" /> : null} Save answers</button>
          <button type="button" onClick={() => void generate()} disabled={Boolean(busy) || Boolean(remaining.length)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#05070D] px-5 text-sm font-semibold text-[#F4F7FB] disabled:opacity-50">{busy === "generate" ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Write this resume</button>
        </div>
        {remaining.length > 0 && <p className="mt-3 text-xs text-[#93A0B5]">{remaining.length === 1 ? "1 mandatory qualification still needs your answer." : `${remaining.length} mandatory qualifications still need your answer.`}</p>}
      </section>

      {target.currentVersion && (
        <section>
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Version {target.currentVersion.versionNumber}</p>
            <h2 className="mt-1 text-2xl font-semibold text-[#F4F7FB]">Targeted resume</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#93A0B5]">Same content. Switch the layout, color, type, and header.</p>
          </div>
          <ResumeProjectEditor targetId={target.id} projects={target.currentVersion.content.projects} catalog={projectCatalog} />
          <ResumeLayoutGallery content={target.currentVersion.content} targetId={target.id} />
        </section>
      )}
    </div>
  );
}
