"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck2, LoaderCircle, Save, ShieldCheck } from "lucide-react";
import type { MasterResumeContent, MasterResumeView } from "@/lib/resumes/types";
import { formatResumeDate } from "@/lib/resumes/format";

export function MasterResumeStudio({ resume }: { resume: MasterResumeView | null }) {
  const router = useRouter();
  const defaultVersion = resume?.versions.find((version) => version.status === "REVIEW") ?? resume?.versions.find((version) => version.id === resume.currentVersionId) ?? resume?.versions[0] ?? null;
  const [selectedId, setSelectedId] = useState(defaultVersion?.id ?? "");
  const selected = useMemo(() => resume?.versions.find((version) => version.id === selectedId) ?? defaultVersion, [defaultVersion, resume, selectedId]);
  const [draft, setDraft] = useState<MasterResumeContent | null>(selected?.content ? structuredClone(selected.content) : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (defaultVersion?.id) setSelectedId(defaultVersion.id); }, [defaultVersion?.id]);
  useEffect(() => setDraft(selected?.content ? structuredClone(selected.content) : null), [selected]);

  async function submit(body: Record<string, unknown>, label: string) {
    setBusy(label); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/resumes/master", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; versionNumber?: number };
      if (!response.ok) throw new Error(payload.error ?? "Master Resume request failed.");
      setMessage(body.action === "APPROVE" ? "Master Resume approved. Job-specific tailoring is now available." : `Master Resume version ${payload.versionNumber ?? ""} is ready for review.`);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Master Resume request failed."); }
    finally { setBusy(null); }
  }

  function updateBullet(key: string, text: string) {
    if (!draft) return;
    setDraft({ ...draft, experiences: draft.experiences.map((experience) => ({ ...experience, bullets: experience.bullets.map((bullet) => bullet.key === key ? { ...bullet, text } : bullet) })), projects: draft.projects.map((project) => ({ ...project, bullets: project.bullets.map((bullet) => bullet.key === key ? { ...bullet, text } : bullet) })) });
  }

  if (!resume || !selected || !draft) return <section className="mt-8 rounded-[2rem] border border-[#1C283C] bg-[#101828] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,.08)]"><FileCheck2 className="mx-auto size-10 text-[#22D3EE]" /><h2 className="mt-4 text-2xl font-semibold text-[#F4F7FB]">Build your evidence-backed Master Resume</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">KYM Mail will assemble a general-purpose presentation only from confirmed Career Profile evidence. You review and approve it before any job-specific tailoring.</p><button type="button" disabled={Boolean(busy)} onClick={() => void submit({ action: "CREATE" }, "create")} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full kym-action px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Create Master Resume</button>{error && <p role="alert" className="mt-4 text-sm text-[#67E8F9]">{error}</p>}</section>;

  const editable = selected.status === "REVIEW";
  return <div className="mt-8 grid min-w-0 gap-6 xl:grid-cols-[.82fr_1.18fr]">
    <section className="min-w-0 rounded-[2rem] border border-[#1C283C] bg-[#101828] p-5 shadow-[0_24px_80px_rgba(0,0,0,.07)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Presentation authority</p><h2 className="mt-1 text-2xl font-semibold text-[#F4F7FB]">Master Resume</h2></div><select aria-label="Master Resume version" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-h-11 rounded-xl border border-[#1C283C] bg-[#101828] px-3 text-sm font-semibold text-[#F4F7FB]">{resume.versions.map((version) => <option value={version.id} key={version.id}>Version {version.versionNumber} · {version.status}</option>)}</select></div>
      {selected.status === "STALE" && <p className="mt-4 flex gap-2 rounded-2xl bg-[#2A1218] p-3 text-sm text-[#22D3EE]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />Career information changed. Create and review a refreshed Master Resume.</p>}
      {message && <p className="mt-4 flex gap-2 rounded-2xl bg-[#0C241C] p-3 text-sm text-[#34D399]"><CheckCircle2 className="size-4" />{message}</p>}{error && <p role="alert" className="mt-4 rounded-2xl bg-[#2A1218] p-3 text-sm text-[#67E8F9]">{error}</p>}
      <label className="mt-6 block text-sm font-semibold text-[#F4F7FB]">Executive summary<textarea disabled={!editable} rows={7} value={draft.summary.text} onChange={(event) => setDraft({ ...draft, summary: { ...draft.summary, text: event.target.value } })} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#101828] p-3 text-sm font-normal leading-6 text-[#93A0B5] disabled:bg-[#05070D]" /></label>
      <div className="mt-6 space-y-6">{draft.experiences.map((experience) => <section key={experience.experienceId}><h3 className="text-sm font-semibold text-[#F4F7FB]">{experience.title} · {experience.employer}</h3><p className="text-xs text-[#93A0B5]">Employer, title, and dates are locked Career Profile facts.</p><div className="mt-3 space-y-3">{experience.bullets.map((bullet) => <textarea key={bullet.key} disabled={!editable} aria-label={`Master Resume bullet for ${experience.employer}`} rows={4} value={bullet.text} onChange={(event) => updateBullet(bullet.key, event.target.value)} className="w-full rounded-2xl border border-[#1C283C] bg-[#101828] p-3 text-sm leading-6 text-[#93A0B5] disabled:bg-[#05070D]" />)}</div></section>)}</div>
      {editable && <div className="mt-7 flex flex-wrap gap-3"><button type="button" disabled={Boolean(busy)} onClick={() => void submit({ action: "EDIT", content: draft }, "save")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#22D3EE] px-5 text-sm font-semibold text-[#22D3EE]"><Save className="size-4" /> Save New Review Version</button><button type="button" disabled={Boolean(busy)} onClick={() => void submit({ action: "APPROVE", versionId: selected.id }, "approve")} className="inline-flex min-h-11 items-center gap-2 rounded-full kym-action px-5 text-sm font-semibold text-white"><ShieldCheck className="size-4" /> Approve Master Resume</button></div>}
    </section>
    <article aria-label="Master Resume preview" className="min-w-0 rounded-sm bg-[#101828] px-5 py-8 text-[#F4F7FB] shadow-[0_22px_70px_rgba(55,27,40,.12)] sm:px-10 lg:px-14"><header className="border-b border-[#1C283C] pb-6"><p className="text-xs font-semibold uppercase tracking-[.24em] text-[#22D3EE]">Executive profile</p><h2 className="mt-2 text-4xl font-semibold tracking-[-.05em] text-[#F4F7FB]">{draft.candidate.fullName}</h2><p className="mt-2 text-sm text-[#93A0B5]">{draft.candidate.headline}</p></header><section className="mt-7"><h3 className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Profile</h3><p className="mt-3 text-sm leading-7 text-[#93A0B5]">{draft.summary.text}</p></section><section className="mt-7"><h3 className="text-xs font-semibold uppercase tracking-[.18em] text-[#22D3EE]">Experience</h3><div className="mt-4 space-y-6">{draft.experiences.map((experience) => <section key={experience.experienceId}><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-[#F4F7FB]">{experience.title} · {experience.employer}</h4><span className="text-xs text-[#93A0B5]">{formatResumeDate(experience.startDate, experience.startPrecision)} – {formatResumeDate(experience.endDate, experience.endPrecision, experience.isCurrent)}</span></div><ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-[#93A0B5]">{experience.bullets.map((bullet) => <li key={bullet.key}>{bullet.text}</li>)}</ul></section>)}</div></section></article>
  </div>;
}
