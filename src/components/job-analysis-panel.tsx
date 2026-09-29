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
  STRONG_MATCH: { label: "Strong match", classes: "bg-[#0C241C] text-[#34D399]", icon: ShieldCheck },
  MATCH: { label: "Match", classes: "bg-[#10283A] text-[#7DD3FC]", icon: Check },
  PARTIAL_MATCH: { label: "Partial match", classes: "bg-[#1C1708] text-[#FBBF24]", icon: CircleHelp },
  NO_MATCH: { label: "No match", classes: "bg-[#122033] text-[#67E8F9]", icon: X },
  UNVERIFIED: { label: "Unverified", classes: "bg-[#05070D] text-[#93A0B5]", icon: CircleHelp },
  NOT_APPLICABLE: { label: "Not applicable", classes: "bg-[#101828] text-[#93A0B5]", icon: CircleHelp }
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
    <details className="group min-w-0 rounded-2xl border border-[#1C283C] bg-[#101828] open:border-[#1D4E89] open:shadow-[0_10px_30px_rgba(0,0,0,.06)]">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[#122033] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#67E8F9]">{categoryLabels[requirement.category]}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${presentation.classes}`}>
              <StateIcon className="size-3" />{presentation.label}
            </span>
            {requirement.isMaterial && <span className="rounded-full bg-[#0E1C33] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">Material</span>}
          </div>
          <p className="mt-3 break-words text-sm font-semibold leading-6 text-[#F4F7FB]">{requirement.originalText}</p>
        </div>
        <ChevronDown className="mt-1 size-5 shrink-0 text-[#93A0B5] transition group-open:rotate-180" />
      </summary>
      <div className="border-t border-[#1C283C] px-4 pb-5 pt-4 sm:px-5">
        <p className="text-sm leading-6 text-[#93A0B5]">{requirement.explanation}</p>
        {requirement.matchState === "UNVERIFIED" && (
          <p className="mt-3 text-xs leading-5 text-[#93A0B5]">Unknown is not treated as missing. This requirement did not reduce the match percentage.</p>
        )}
        {requirement.matchState === "NO_MATCH" && (
          <p className="mt-3 text-xs leading-5 text-[#67E8F9]">The Master Career Profile was evaluated for this closed-world requirement and no supporting evidence exists.</p>
        )}
        {requirement.evidence.length ? (
          <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
            {requirement.evidence.map((evidence) => (
              <article key={evidence.id} className="min-w-0 rounded-2xl bg-[#2A1218] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#22D3EE]">{evidence.type.replaceAll("_", " ")}</p>
                <h5 className="mt-1 break-words text-sm font-semibold text-[#F4F7FB]">{evidence.label}</h5>
                <p className="mt-2 text-xs leading-5 text-[#93A0B5]">{evidence.explanation}</p>
                <p className="mt-2 line-clamp-5 break-words text-xs leading-5 text-[#93A0B5]">{evidence.excerpt}</p>
              </article>
            ))}
          </div>
        ) : requirement.matchState !== "NOT_APPLICABLE" && requirement.matchState !== "UNVERIFIED" && requirement.matchState !== "NO_MATCH" ? null : requirement.matchState === "NO_MATCH" ? (
          <p className="mt-4 rounded-2xl bg-[#122033] p-4 text-xs leading-5 text-[#67E8F9]">No supporting Master Career Profile evidence was found.</p>
        ) : null}
      </div>
    </details>
  );
}

function RequirementGroup({ title, items }: { title: string; items: RequirementView[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold text-[#F4F7FB]">{title} <span className="font-normal text-[#93A0B5]">({items.length})</span></h4>
      <div className="space-y-3">{items.map((requirement) => <RequirementCard key={requirement.id} requirement={requirement} />)}</div>
    </section>
  );
}

export function JobAnalysisPanel({ jobId, analysis, projectId = null }: { jobId: string; analysis: JobAnalysisView | null; projectId?: string | null }) {
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
  const responsibilities = analysis?.requirements.filter((requirement) => requirement.importance === "RESPONSIBILITY") ?? [];
  const context = analysis?.requirements.filter((requirement) => requirement.importance === "CONTEXT") ?? [];
  const skillsSystems = analysis?.requirements.filter((requirement) => ["SKILL", "TECHNOLOGY", "SYSTEM", "DATA"].includes(requirement.category)) ?? [];
  const partial = analysis?.requirements.filter((requirement) => requirement.matchState === "PARTIAL_MATCH") ?? [];
  const unverified = analysis?.requirements.filter((requirement) => requirement.matchState === "UNVERIFIED") ?? [];
  const noMatch = analysis?.requirements.filter((requirement) => requirement.matchState === "NO_MATCH") ?? [];
  const careerEvidence = [...new Map((analysis?.requirements ?? []).flatMap((requirement) => requirement.evidence).map((item) => [item.label, item])).values()].slice(0, 8);
  const breakdown = analysis?.summary.scoreBreakdown;
  const positive = analysis?.requirements.filter((requirement) => requirement.matchState === "STRONG_MATCH" || requirement.matchState === "MATCH") ?? [];
  const whyYouMatch = analysis?.summary.whyYouMatch?.length
    ? analysis.summary.whyYouMatch
    : positive.slice(0, 6).map((requirement) => `${requirement.originalText}${requirement.evidence[0] ? ` — supported by ${requirement.evidence[0].label}.` : ""}`);
  const whereYouDont = analysis?.summary.whereYouDont?.length
    ? analysis.summary.whereYouDont
    : analysis?.requirements.filter((requirement) => requirement.matchState === "NO_MATCH" || requirement.matchState === "UNVERIFIED" || (requirement.isMaterial && requirement.matchState === "PARTIAL_MATCH")).slice(0, 6).map((requirement) => `${requirement.originalText} — ${requirement.explanation}`) ?? [];
  const resumeUnderselling = analysis?.summary.resumeUnderselling?.length
    ? analysis.summary.resumeUnderselling
    : [...new Set(positive.flatMap((requirement) => requirement.evidence.filter((item) => item.relevanceScore >= 62 && ["PROJECT", "ACCOMPLISHMENT", "METRIC"].includes(item.type)).map((item) => `${item.label}: ${item.excerpt}`)))].slice(0, 5);
  const recommendedResumeStrategy = analysis?.summary.recommendedResumeStrategy?.length
    ? analysis.summary.recommendedResumeStrategy
    : [
      positive[0]?.evidence[0] ? `Lead with ${positive[0].evidence[0].label}, which directly supports a high-value requirement.` : null,
      "Mirror the job's terminology only where confirmed Master Career Profile evidence supports it.",
      resumeUnderselling.length ? "Elevate the strongest authoritative project, accomplishment, and metric evidence without changing or inventing facts." : null,
      whereYouDont.length ? "Do not claim unsupported qualifications; distinguish unknown requirements from verified gaps." : null
    ].filter((item): item is string => Boolean(item));
  const analyzedAt = formatTimestamp(analysis?.completedAt ?? analysis?.lastSuccessfulCompletedAt);
  const busy = submitting || analysis?.status === "ANALYZING";

  return (
    <section className="mt-7 min-w-0 overflow-hidden rounded-[2rem] border border-[#1C283C] bg-[#101828] shadow-[0_20px_60px_rgba(0,0,0,.08)]">
      <header className="border-b border-[#1C283C] bg-[#101828] p-5 sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Career intelligence</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-[#F4F7FB]"><Target className="size-6 text-[#22D3EE]" /> Career Match</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#93A0B5]">How well this job matches the authoritative Master Career Profile, with verified evidence and genuine gaps.</p>
          </div>
          <button type="button" onClick={() => void analyze()} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(37,99,235,.24)] disabled:bg-[#0E1C33]">
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : analysis ? <RefreshCw className="size-4" /> : <FileSearch className="size-4" />}
            {busy ? "Analyzing…" : analysis ? "Re-analyze Match" : "Analyze Match"}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 rounded-2xl border border-[#1D4E89] bg-[#101828] px-4 py-3 text-sm text-[#67E8F9]">{error}</p>}
      </header>

      {!analysis && (
        <div className="p-6 sm:p-8">
          <div className="rounded-3xl border border-dashed border-[#1D4E89] bg-[#2A1218] p-6 text-center">
            <Gauge className="mx-auto size-8 text-[#22D3EE]" />
            <h3 className="mt-3 text-lg font-semibold text-[#F4F7FB]">Not analyzed yet</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#93A0B5]">Analyze the complete available description to extract structured requirements, score them against confirmed Master Career Profile evidence, and persist the result.</p>
          </div>
        </div>
      )}

      {analysis?.status === "ANALYZING" && (
        <div className="p-8 text-center">
          <LoaderCircle className="mx-auto size-8 animate-spin text-[#22D3EE]" />
          <p className="mt-3 font-semibold text-[#F4F7FB]">Analysis is in progress</p>
          <p className="mt-2 text-sm text-[#93A0B5]">Requirements and career evidence are being evaluated. This is not a disabled dead-end; retry if it does not finish.</p>
        </div>
      )}

      {analysis?.status === "FAILED" && (
        <div className="border-b border-[#1D4E89] bg-[#2A1218] px-5 py-4 sm:px-7">
          <h3 className="flex items-center gap-2 font-semibold text-[#67E8F9]"><AlertTriangle className="size-5" /> Analysis could not be completed</h3>
          <p className="mt-2 text-sm leading-6 text-[#93A0B5]">{analysis.failureMessage || "Retry the analysis. Existing saved-job and career data remain unchanged."}</p>
          {analysis.previousSuccessPreserved && <p className="mt-2 text-sm font-semibold text-[#F4F7FB]">The last successful analysis is still shown below and was not destroyed.</p>}
        </div>
      )}

      {analysis?.status === "STALE" && (
        <div className="border-b border-[#1D4E89] bg-[#2A1218] px-5 py-4 sm:px-7">
          <p className="flex items-start gap-2 text-sm font-semibold text-[#67E8F9]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />This analysis is stale because the job description or Master Career Profile changed. Re-analyze before relying on the score.</p>
        </div>
      )}

      {showResults && analysis && (
        <div className="min-w-0 space-y-8 p-5 sm:p-7">
          {analysis.status === "COMPLETE" && (
            <section className="flex flex-col gap-4 rounded-3xl border border-[#1D4E89] bg-[#122033] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-[#F4F7FB]"><FileText className="size-5 text-[#22D3EE]" />Create a tailored resume</h3>
                <p className="mt-1 text-sm leading-6 text-[#93A0B5]">Build a versioned, evidence-validated resume from this Career Match and the Master Career Profile.</p>
              </div>
              <Link href={`/app/jobs/saved/${jobId}/resume${projectId ? `?project=${projectId}` : ""}`} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full kym-action px-5 py-3 text-sm font-semibold text-white">Tailor Resume</Link>
            </section>
          )}
          <div className="grid min-w-0 gap-5 lg:grid-cols-[.7fr_1.3fr]">
            <section className="flex min-h-60 min-w-0 flex-col items-center justify-center rounded-3xl bg-[#0E1C33] p-6 text-center text-white">
              <BarChart3 className="size-6 text-[#F4F7FB]" />
              <p className="mt-3 text-xs font-semibold uppercase tracking-[.18em] text-[#F4F7FB]">Overall match</p>
              <p className="mt-1 text-6xl font-semibold tracking-[-.07em] sm:text-7xl">{analysis.overallScore ?? 0}<span className="text-3xl">%</span></p>
              <p className="mt-3 text-sm font-semibold text-[#F4F7FB]">{matchClassification(analysis.overallScore ?? 0)}</p>
              <p className="mt-3 max-w-sm text-xs leading-5 text-[#F4F7FB]">{analysis.summary.scoreExplanation || "Deterministic weighted score from structured requirements."}</p>
              <p className="mt-3 text-xs leading-5 text-[#F4F7FB]">{analysis.summary.requirementCount ?? analysis.requirements.length} structured requirements · Version {analysis.version}{analyzedAt ? ` · ${analyzedAt}` : ""}</p>
            </section>
            <div className="grid min-w-0 gap-5 md:grid-cols-2">
              <section className="rounded-3xl border border-[#14523A] bg-[#0C241C] p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[#F4F7FB]"><Sparkles className="size-4 text-[#34D399]" />Strongest matches</h3>
                {strongestAreas.length ? <ul className="mt-4 space-y-3">{strongestAreas.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#93A0B5]"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-[#0E1C33]" />{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No strong or full matches were established.</p>}
              </section>
              <section className="rounded-3xl border border-[#1D4E89] bg-[#2A1218] p-5">
                <h3 className="flex items-center gap-2 text-base font-semibold text-[#F4F7FB]"><AlertTriangle className="size-4 text-[#22D3EE]" />Material gaps</h3>
                {materialGaps.length ? <ul className="mt-4 space-y-3">{materialGaps.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-[#93A0B5]"><span className="mt-2 size-1.5 shrink-0 rounded-full kym-action" />{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No material required qualifications are currently unmatched or unverified.</p>}
              </section>
            </div>
          </div>

          {breakdown && (
            <section>
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#22D3EE]">Score explanation</p>
              <h3 className="mt-1 text-xl font-semibold text-[#F4F7FB]">Where {analysis.overallScore ?? 0}% came from</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#93A0B5]">{breakdown.explanation}</p>
              <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {(["REQUIRED", "RESPONSIBILITY", "PREFERRED", "CONTEXT"] as const).map((importance) => {
                  const slice = breakdown.byImportance[importance] ?? { count: 0, earnedPoints: 0, possiblePoints: 0, score: null };
                  const weight = breakdown.weights[importance] ?? ({ REQUIRED: 5, RESPONSIBILITY: 3, PREFERRED: 2, CONTEXT: 1 } as const)[importance];
                  return (
                    <article key={importance} className="rounded-2xl border border-[#1C283C] bg-[#101828] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#22D3EE]">{importance.toLowerCase()}</p>
                      <p className="mt-2 text-2xl font-semibold text-[#F4F7FB]">{slice.score === null ? "—" : `${slice.score}%`}</p>
                      <p className="mt-1 text-xs leading-5 text-[#93A0B5]">{slice.earnedPoints}/{slice.possiblePoints} weighted points · {slice.count} requirements · weight {weight}</p>
                    </article>
                  );
                })}
              </div>
              <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(breakdown.byCategory).map(([category, slice]) => (
                  <article key={category} className="min-w-0 rounded-2xl bg-[#2A1218] p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#67E8F9]">{categoryLabels[category as RequirementCategory]}</p>
                    <p className="mt-1 text-lg font-semibold text-[#F4F7FB]">{slice.score === null ? "—" : `${slice.score}%`}</p>
                    <p className="text-xs text-[#93A0B5]">{slice.earnedPoints}/{slice.possiblePoints} points</p>
                  </article>
                ))}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#93A0B5]">Unverified {breakdown.unverifiedCount} · No match {breakdown.byState.NO_MATCH} · Partial {breakdown.byState.PARTIAL_MATCH}. Unverified and not-applicable requirements are omitted from both earned and possible points.</p>
            </section>
          )}

          <RequirementGroup title="Required qualifications" items={required} />
          <RequirementGroup title="Preferred qualifications" items={preferred} />
          <RequirementGroup title="Responsibilities" items={responsibilities} />
          <RequirementGroup title="Role and company context" items={context} />
          <RequirementGroup title="Skills, systems, and data" items={skillsSystems} />

          <section className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#22D3EE]">Why screen</p>
            <h3 className="mt-1 text-xl font-semibold text-[#F4F7FB]">What the evidence means for this application</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#93A0B5]">These recommendations are derived from persisted requirements and confirmed Master Career Profile records. They do not generate or rewrite a résumé.</p>
            <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
              <article className="min-w-0 rounded-3xl border border-[#14523A] bg-[#0C241C] p-5">
                <h4 className="text-base font-semibold text-[#F4F7FB]">Why you match</h4>
                {whyYouMatch.length ? <ul className="mt-3 space-y-3">{whyYouMatch.map((item) => <li key={item} className="break-words text-sm leading-6 text-[#93A0B5]">{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No positive match is supported strongly enough to present.</p>}
              </article>
              <article className="min-w-0 rounded-3xl border border-[#1D4E89] bg-[#2A1218] p-5">
                <h4 className="text-base font-semibold text-[#F4F7FB]">Where you don&apos;t</h4>
                {whereYouDont.length ? <ul className="mt-3 space-y-3">{whereYouDont.map((item) => <li key={item} className="break-words text-sm leading-6 text-[#93A0B5]">{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No verified gaps or unresolved requirements were identified.</p>}
              </article>
              <article className="min-w-0 rounded-3xl border border-[#1D4E89] bg-[#101828] p-5">
                <h4 className="text-base font-semibold text-[#F4F7FB]">Resume is underselling you</h4>
                <p className="mt-2 text-xs leading-5 text-[#93A0B5]">Review whether these especially relevant authoritative facts are prominent in the current résumé. KYM Mail does not assume they are absent.</p>
                {resumeUnderselling.length ? <ul className="mt-3 space-y-3">{resumeUnderselling.map((item) => <li key={item} className="break-words text-sm leading-6 text-[#93A0B5]">{item}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-[#93A0B5]">No project, accomplishment, or metric met the deterministic relevance threshold for this section.</p>}
              </article>
              <article className="min-w-0 rounded-3xl bg-[#0E1C33] p-5 text-white">
                <h4 className="text-base font-semibold">Recommended resume strategy</h4>
                <ol className="mt-3 space-y-3">{recommendedResumeStrategy.map((item, index) => <li key={item} className="break-words text-sm leading-6 text-[#F4F7FB]"><span className="mr-2 font-semibold text-[#F4F7FB]">{index + 1}.</span>{item}</li>)}</ol>
              </article>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-[#F4F7FB]">Relevant career evidence</h3>
            <p className="mt-2 text-sm leading-6 text-[#93A0B5]">Only persisted Master Career Profile records can support a positive or partial match.</p>
            <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
              {careerEvidence.length ? careerEvidence.map((evidence) => (
                <article key={evidence.id} className="min-w-0 rounded-2xl border border-[#1C283C] bg-[#101828] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[#22D3EE]">{evidence.type.replaceAll("_", " ")}</p>
                  <h4 className="mt-1 break-words text-sm font-semibold text-[#F4F7FB]">{evidence.label}</h4>
                  <p className="mt-2 break-words text-xs leading-5 text-[#93A0B5]">{evidence.excerpt}</p>
                </article>
              )) : <p className="text-sm text-[#93A0B5]">No supporting career evidence was linked for this analysis.</p>}
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-[#F4F7FB]">Gaps and unverified requirements</h3>
            <p className="mt-2 text-sm leading-6 text-[#93A0B5]">No match means the profile was checked and the qualification is unsupported. Unverified means the profile does not contain enough information to decide.</p>
            <div className="mt-4 space-y-6">
              <RequirementGroup title="No matches" items={noMatch} />
              <RequirementGroup title="Partial matches" items={partial} />
              <RequirementGroup title="Unverified requirements" items={unverified} />
              {!noMatch.length && !partial.length && !unverified.length && <p className="text-sm text-[#93A0B5]">No gaps or unverified requirements were recorded.</p>}
            </div>
          </section>

          <details className="rounded-2xl border border-[#1C283C] bg-[#101828] p-4 text-sm leading-6 text-[#93A0B5]">
            <summary className="cursor-pointer font-semibold text-[#F4F7FB]">Match-state criteria</summary>
            <ul className="mt-3 space-y-2">{Object.entries(MATCH_STATE_CRITERIA).map(([state, criteria]) => <li key={state}><span className="font-semibold text-[#F4F7FB]">{statePresentation[state as RequirementMatchState].label}:</span> {criteria}</li>)}</ul>
          </details>
        </div>
      )}
    </section>
  );
}
