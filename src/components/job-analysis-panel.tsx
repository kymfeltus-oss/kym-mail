"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, BarChart3, Check, ChevronDown, CircleHelp, FileSearch, FileText, Gauge, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Target, X } from "lucide-react";
import type { RequirementCategory, RequirementMatchState } from "@/lib/jobs/analysis";
import type { JobAnalysisView, RequirementView } from "@/lib/jobs/analysis-view";

export type { JobAnalysisView };

function matchClassification(score: number) {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good match";
  if (score >= 50) return "Mixed match";
  return "Weak match";
}

const MATCH_STATE_CRITERIA: Record<RequirementMatchState, string> = {
  STRONG_MATCH: "Deterministic relevance is 82 or higher: strong token coverage, a direct evidence-label or canonical-concept match, or fully met years-of-experience evidence.",
  MATCH: "Deterministic relevance is 62–81: compatible Master Career Profile evidence covers most of the requirement.",
  PARTIAL_MATCH: "Deterministic relevance is 30–61: related authoritative evidence exists but does not fully establish the requirement. Related concepts cannot become a strong match on relatedness alone.",
  NO_MATCH: "A closed-world requirement was evaluated against the Master Career Profile and no supporting authoritative evidence exists.",
  UNVERIFIED: "The Master Career Profile does not contain enough information to determine whether the requirement is met. Unknown is not treated as absence.",
  NOT_APPLICABLE: "The item is legal, compensation, benefits, or authorization language and is excluded from scoring."
};

const statePresentation: Record<RequirementMatchState, { label: string; classes: string; icon: typeof Check }> = {
  STRONG_MATCH: { label: "Strong match", classes: "bg-[#E9F7F1] text-[#176B4C]", icon: ShieldCheck },
  MATCH: { label: "Match", classes: "bg-[#EEF5FA] text-[#285D83]", icon: Check },
  PARTIAL_MATCH: { label: "Partial match", classes: "bg-[#FFF5E7] text-[#9A5B13]", icon: CircleHelp },
  NO_MATCH: { label: "No match", classes: "bg-[#FFF0F1] text-[#A73D52]", icon: X },
  UNVERIFIED: { label: "Unverified", classes: "bg-[#F1F5F9] text-[#475569]", icon: CircleHelp },
  NOT_APPLICABLE: { label: "Not applicable", classes: "bg-[#F8FAFC] text-[#64748B]", icon: CircleHelp }
};

const categoryLabels: Record<RequirementCategory, string> = {
  RESPONSIBILITY: "Responsibility",
  SKILL: "Skill",
  TECHNOLOGY: "Technology",
  SYSTEM: "System",
  ACCOUNTING: "Accounting",
  FINANCE: "Finance",
  DATA: "Data",
  EDUCATION: "Education",
  CERTIFICATION: "Certification",
  EXPERIENCE: "Experience",
  LEADERSHIP: "Leadership",
  INDUSTRY: "Industry",
  OTHER: "Qualification"
};

function formatTimestamp(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago" }).format(new Date(value));
}

function RequirementCard({ requirement }: { requirement: RequirementView }) {
  const presentation = statePresentation[requirement.matchState];
  const StateIcon = presentation.icon;
  return (
    <details className="group min-w-0 rounded-2xl border border-[#E8E2E3] bg-white open:border-[#E7B8C1] open:shadow-[0_10px_30px_rgba(24,58,90,.06)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#FFF3F4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#A73D52]">{categoryLabels[requirement.category]}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${presentation.classes}`}>
              <StateIcon className="size-3" />{presentation.label}
            </span>
            {requirement.isMaterial && <span className="rounded-full bg-[#183A5A] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Material</span>}
          </div>
          <p className="mt-3 break-words text-sm font-semibold leading-6 text-[#183A5A]">{requirement.originalText}</p>
        </div>
        <ChevronDown className="mt-1 size-5 shrink-0 text-[#64748B] transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#E8E2E3] px-4 pb-5 pt-4 sm:px-5">
        <p className="text-sm leading-6 text-[#64748B]">{requirement.explanation}</p>
        {requirement.matchState === "UNVERIFIED" && (
          <p className="mt-3 text-xs leading-5 text-[#475569]">Unknown is not treated as missing. This requirement did not reduce the match percentage.</p>
        )}
        {requirement.matchState === "NO_MATCH" && (
          <p className="mt-3 text-xs leading-5 text-[#A73D52]">The Master Career Profile was evaluated for this closed-world requirement and no supporting evidence exists.</p>
        )}
        {requirement.evidence.length ? (
          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
            {requirement.evidence.map((evidence) => (
              <article key={evidence.id} className="min-w-0 rounded-2xl bg-[#FFF8F8] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#D95B72]">{evidence.type.replaceAll("_", " ")}</p>
                <h5 className="mt-1 break-words text-sm font-semibold text-[#183A5A]">{evidence.label}</h5>
                <p className="mt-2 text-xs leading-5 text-[#64748B]">{evidence.explanation}</p>
                <p className="mt-2 line-clamp-5 break-words text-xs leading-5 text-[#465B70]">{evidence.excerpt}</p>
              </article>
            ))}
          </div>
        ) : requirement.matchState !== "NOT_APPLICABLE" && requirement.matchState !== "UNVERIFIED" && requirement.matchState !== "NO_MATCH" ? null : requirement.matchState === "NO_MATCH" ? (
          <p className="mt-4 rounded-2xl bg-[#FFF0F1] p-4 text-xs leading-5 text-[#A73D52]">No supporting Master Career Profile evidence was found.</p>
        ) : null}
      </div>
    </details>
  );
}

function RequirementGroup({ title, items }: { title: string; items: RequirementView[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold text-[#183A5A]">{title} <span className="font-normal text-[#64748B]">({items.length})</span></h4>
      <div className="space-y-3">{items.map((requirement) => <RequirementCard key={requirement.id} requirement={requirement} />)}</div>
    </section>
  );
}

export function JobAnalysisPanel({ jobId, analysis }: { jobId: string; analysis: JobAnalysisView | null }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/analysis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "KYM Mail could not complete this analysis.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "KYM Mail could not complete this analysis.");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const hasResults = Boolean(analysis?.requirements.length);
  const showResults = hasResults && analysis && analysis.status !== "ANALYZING";
  const strongestAreas = analysis?.summary.strongestAreas ?? [];
  const materialGaps = analysis?.summary.materialGaps ?? [];
  const required = analysis?.requirements.filter((requirement) => requirement.importance === "REQUIRED") ?? [];
  const preferred = analysis?.requirements.filter((requirement) => requirement.importance === "PREFERRED") ?? [];
  const context = analysis?.requirements.filter((requirement) => requirement.importance === "CONTEXT") ?? [];
  const skillsSystems = analysis?.requirements.filter((requirement) => ["SKILL", "TECHNOLOGY", "SYSTEM", "DATA"].includes(requirement.category)) ?? [];
  const partial = analysis?.requirements.filter((requirement) => requirement.matchState === "PARTIAL_MATCH") ?? [];
  const unverified = analysis?.requirements.filter((requirement) => requirement.matchState === "UNVERIFIED") ?? [];
  const noMatch = analysis?.requirements.filter((requirement) => requirement.matchState === "NO_MATCH") ?? [];
  const careerEvidence = [...new Map((analysis?.requirements ?? []).flatMap((requirement) => requirement.evidence).map((item) => [item.label, item])).values()].slice(0, 8);
  const breakdown = analysis?.summary.scoreBreakdown;
  const analyzedAt = formatTimestamp(analysis?.completedAt ?? analysis?.lastSuccessfulCompletedAt);
  const busy = submitting || analysis?.status === "ANALYZING";

  return (
    <section className="mt-7 min-w-0 overflow-hidden rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] shadow-[0_20px_60px_rgba(24,58,90,.08)]">
      <header className="border-b border-[#E8E2E3] bg-[linear-gradient(135deg,#FFF3F4_0%,#FFFCFB_70%)] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#D95B72]">Career intelligence</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-[#183A5A]"><Target className="size-6 text-[#D95B72]" /> Career Match</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#64748B]">How well this job matches the authoritative Master Career Profile, with verified evidence and genuine gaps.</p>
          </div>
          <button type="button" onClick={() => void analyze()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(217,91,114,.24)] disabled:bg-[#D7A6AF]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : analysis ? <RefreshCw className="size-4" /> : <FileSearch className="size-4" />}
            {busy ? "Analyzing…" : analysis ? "Re-analyze Match" : "Analyze Match"}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-2xl border border-[#F0CDD4] bg-white px-4 py-3 text-sm text-[#A73D52]">{error}</p>}
      </header>

      {!analysis && (
        <div className="p-6 sm:p-8">
          <div className="rounded-3xl border border-dashed border-[#E7B8C1] bg-[#FFF8F8] p-6 text-center">
            <Gauge className="mx-auto size-8 text-[#D95B72]" />
            <h3 className="mt-3 text-lg font-semibold text-[#183A5A]">Not analyzed yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">Analyze the complete available description to extract structured requirements, score them against Gate 6 career evidence, and persist the result.</p>
          </div>
        </div>
      )}

      {analysis?.status === "ANALYZING" && (
        <div className="p-8 text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-[#D95B72]" />
          <p className="mt-3 font-semibold text-[#183A5A]">Analysis is in progress</p>
          <p className="mt-2 text-sm text-[#64748B]">Requirements and career evidence are being evaluated. This is not a disabled dead-end; retry if it does not finish.</p>
        </div>
      )}

      {analysis?.status === "FAILED" && (
        <div className="border-b border-[#F0CDD4] bg-[#FFF8F8] px-5 py-4 sm:px-7">
          <h3 className="flex items-center gap-2 font-semibold text-[#A73D52]"><AlertTriangle className="size-5" /> Analysis could not be completed</h3>
          <p className="mt-2 text-sm leading-6 text-[#64748B]">{analysis.failureMessage || "Retry the analysis. Existing saved-job and career data remain unchanged."}</p>
          {analysis.previousSuccessPreserved && <p className="mt-2 text-sm font-semibold text-[#183A5A]">The last successful analysis is still shown below and was not destroyed.</p>}
        </div>
      )}

      {analysis?.status === "STALE" && (
        <div className="border-b border-[#F0CDD4] bg-[#FFF8F8] px-5 py-4 sm:px-7">
          <p className="flex items-start gap-2 text-sm font-semibold text-[#A73D52]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />This analysis is stale because the job description or Master Career Profile changed. Re-analyze before relying on the score.</p>
        </div>
      )}

      {showResults && analysis && (
        <div className="min-w-0 space-y-8 p-5 sm:p-7">
          {analysis.status === "COMPLETE" && (
            <section className="flex flex-col gap-4 rounded-3xl border border-[#E7B8C1] bg-[linear-gradient(135deg,#FFF3F4,#FFFCFB)] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#183A5A]"><FileText className="size-5 text-[#D95B72]" />Create a tailored resume</h3>
                <p className="mt-1 text-sm leading-6 text-[#64748B]">Build a versioned, evidence-validated resume from this Career Match and the Master Career Profile.</p>
              </div>
              <Link href={`/app/jobs/saved/${jobId}/resume`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white">Open Resume Studio</Link>
            </section>
          )}
          <div className="grid min-w-0 gap-5 lg:grid-cols-[.7fr_1.3fr]">
            <section className="flex min-h-60 min-w-0 flex-col items-center justify-center rounded-3xl bg-[#183A5A] p-6 text-center text-white">
              <BarChart3 className="size-6 text-[#F7DDE1]" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[.18em] text-[#F7DDE1]">Overall match</p>
              <p className="mt-1 text-6xl font-semibold tracking-[-.07em] sm:text-7xl">{analysis.overallScore ?? 0}<span className="text-3xl">%</span></p>
              <p className="mt-3 text-sm font-semibold text-[#F7DDE1]">{matchClassification(analysis.overallScore ?? 0)}</p>
              <p className="mt-3 max-w-sm text-xs leading-5 text-[#DDE8F0]">{analysis.summary.scoreExplanation || "Deterministic weighted score from structured requirements."}</p>
              <p className="mt-3 text-xs leading-5 text-[#DDE8F0]">{analysis.summary.requirementCount ?? analysis.requirements.length} structured requirements · Version {analysis.version}{analyzedAt ? ` · ${analyzedAt}` : ""}</p>
            </section>
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <section className="rounded-3xl border border-[#CFE8DD] bg-[#F5FCF8] p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[#183A5A]"><Sparkles className="size-4 text-[#2F8A67]" />Strongest matches</h3>
                {strongestAreas.length ? <ul className="mt-4 space-y-3">{strongestAreas.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#465B70]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#2F8A67]" />{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#64748B]">No strong or full matches were established.</p>}
              </section>
              <section className="rounded-3xl border border-[#F0CDD4] bg-[#FFF8F8] p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[#183A5A]"><AlertTriangle className="size-4 text-[#D95B72]" />Material gaps</h3>
                {materialGaps.length ? <ul className="mt-4 space-y-3">{materialGaps.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#465B70]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#D95B72]" />{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#64748B]">No material required qualifications are currently unmatched or unverified.</p>}
              </section>
            </div>
          </div>

          {breakdown && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Score explanation</p>
              <h3 className="mt-1 text-xl font-semibold text-[#183A5A]">Where {analysis.overallScore ?? 0}% came from</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#64748B]">{breakdown.explanation}</p>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-3">
                {(["REQUIRED", "PREFERRED", "CONTEXT"] as const).map((importance) => {
                  const slice = breakdown.byImportance[importance];
                  return (
                    <article key={importance} className="rounded-2xl border border-[#E8E2E3] bg-white p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#D95B72]">{importance.toLowerCase()}</p>
                      <p className="mt-2 text-2xl font-semibold text-[#183A5A]">{slice.score === null ? "—" : `${slice.score}%`}</p>
                      <p className="mt-1 text-xs leading-5 text-[#64748B]">{slice.earnedPoints}/{slice.possiblePoints} weighted points · {slice.count} requirements · weight {breakdown.weights[importance]}</p>
                    </article>
                  );
                })}
              </div>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(breakdown.byCategory).map(([category, slice]) => (
                  <article key={category} className="min-w-0 rounded-2xl bg-[#FFF8F8] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#A73D52]">{categoryLabels[category as RequirementCategory]}</p>
                    <p className="mt-1 text-lg font-semibold text-[#183A5A]">{slice.score === null ? "—" : `${slice.score}%`}</p>
                    <p className="text-xs text-[#64748B]">{slice.earnedPoints}/{slice.possiblePoints} points</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#64748B]">Unverified {breakdown.unverifiedCount} · No match {breakdown.byState.NO_MATCH} · Partial {breakdown.byState.PARTIAL_MATCH}. Unverified and not-applicable requirements are omitted from both earned and possible points.</p>
            </section>
          )}

          <RequirementGroup title="Required qualifications" items={required} />
          <RequirementGroup title="Preferred qualifications" items={preferred} />
          <RequirementGroup title="Additional responsibilities" items={context} />
          <RequirementGroup title="Skills, systems, and data" items={skillsSystems} />

          <section>
            <h3 className="text-xl font-semibold text-[#183A5A]">Relevant career evidence</h3>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">Only persisted Master Career Profile records can support a positive or partial match.</p>
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
              {careerEvidence.length ? careerEvidence.map((evidence) => (
                <article key={evidence.id} className="min-w-0 rounded-2xl border border-[#E8E2E3] bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#D95B72]">{evidence.type.replaceAll("_", " ")}</p>
                  <h4 className="mt-1 break-words text-sm font-semibold text-[#183A5A]">{evidence.label}</h4>
                  <p className="mt-2 break-words text-xs leading-5 text-[#64748B]">{evidence.excerpt}</p>
                </article>
              )) : <p className="text-sm text-[#64748B]">No supporting career evidence was linked for this analysis.</p>}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-[#183A5A]">Gaps and unverified requirements</h3>
            <p className="mt-2 text-sm leading-6 text-[#64748B]">No match means the profile was checked and the qualification is unsupported. Unverified means the profile does not contain enough information to decide.</p>
            <div className="mt-4 space-y-6">
              <RequirementGroup title="No matches" items={noMatch} />
              <RequirementGroup title="Partial matches" items={partial} />
              <RequirementGroup title="Unverified requirements" items={unverified} />
              {!noMatch.length && !partial.length && !unverified.length && <p className="text-sm text-[#64748B]">No gaps or unverified requirements were recorded.</p>}
            </div>
          </section>

          <details className="rounded-2xl border border-[#E8E2E3] bg-white p-4 text-sm leading-6 text-[#64748B]">
            <summary className="cursor-pointer font-semibold text-[#183A5A]">Match-state criteria</summary>
            <ul className="mt-3 space-y-2">{Object.entries(MATCH_STATE_CRITERIA).map(([state, criteria]) => <li key={state}><span className="font-semibold text-[#183A5A]">{statePresentation[state as RequirementMatchState].label}:</span> {criteria}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
