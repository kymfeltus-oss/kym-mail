"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil, Plus, X } from "lucide-react";
import type { TargetResumeContent } from "@/lib/resumes/target/types";

export type ResumeProjectChoice = { id: string; name: string; summary: string; impact: string | null };

export function ResumeProjectEditor({ targetId, projects, catalog }: { targetId: string; projects: TargetResumeContent["projects"]; catalog: ResumeProjectChoice[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(projects);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addId, setAddId] = useState("");
  const unused = catalog.filter((item) => !draft.some((project) => project.projectId === item.id));

  function updateBullet(projectId: string, index: number, text: string) {
    setDraft((current) => current.map((project) => project.projectId === projectId ? { ...project, bullets: project.bullets.map((bullet, bulletIndex) => bulletIndex === index ? text : bullet) } : project));
  }

  function addProject() {
    const choice = catalog.find((item) => item.id === addId);
    if (!choice || draft.length >= 4) return;
    setDraft((current) => [...current, { projectId: choice.id, name: choice.name, bullets: [choice.summary, choice.impact].filter((item): item is string => Boolean(item && item.trim().length >= 10)) }]);
    setAddId("");
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/resumes/targets/${targetId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects: draft })
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "The projects could not be saved.");
      setOpen(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The projects could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <button type="button" onClick={() => { setDraft(projects); setOpen((value) => !value); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#1C283C] px-4 text-sm font-semibold text-[#F4F7FB]">
        <Pencil className="size-4" /> {open ? "Close project editor" : "Edit projects"}
      </button>
      {open && (
        <div className="mt-4 space-y-4 rounded-3xl border border-[#1C283C] bg-[#101828] p-5">
          {error && <p role="alert" className="text-sm text-[#67E8F9]">{error}</p>}
          {draft.map((project) => (
            <section key={project.projectId} className="rounded-2xl border border-[#1C283C] p-4">
              <div className="flex items-start justify-between gap-3">
                <label className="block grow text-sm font-semibold text-[#F4F7FB]">
                  Project name
                  <input value={project.name} maxLength={200} onChange={(event) => setDraft((current) => current.map((item) => item.projectId === project.projectId ? { ...item, name: event.target.value } : item))} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#0B1220] p-3 text-sm font-normal text-[#F4F7FB]" />
                </label>
                <button type="button" onClick={() => setDraft((current) => current.filter((item) => item.projectId !== project.projectId))} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#1C283C] px-3 text-sm font-semibold text-[#F4F7FB]"><X className="size-4" /> Remove</button>
              </div>
              {project.bullets.map((bullet, index) => (
                <label key={`${project.projectId}-${index}`} className="mt-3 block text-sm font-semibold text-[#F4F7FB]">
                  {index === 0 ? "What it is" : "What it does"}
                  <textarea value={bullet} rows={3} maxLength={800} onChange={(event) => updateBullet(project.projectId, index, event.target.value)} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#0B1220] p-3 text-sm font-normal leading-6 text-[#F4F7FB]" />
                </label>
              ))}
            </section>
          ))}
          {unused.length > 0 && draft.length < 4 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select aria-label="Add a project" value={addId} onChange={(event) => setAddId(event.target.value)} className="min-h-11 rounded-full border border-[#1C283C] bg-[#0B1220] px-4 text-sm text-[#F4F7FB]">
                <option value="">Add a Career Profile project</option>
                {unused.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <button type="button" onClick={addProject} disabled={!addId} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#1C283C] px-4 text-sm font-semibold text-[#F4F7FB] disabled:opacity-50"><Plus className="size-4" /> Add</button>
            </div>
          )}
          <button type="button" onClick={() => void save()} disabled={busy || draft.some((project) => project.name.trim().length < 2 || project.bullets.some((bullet) => bullet.trim().length < 10))} className="inline-flex min-h-11 items-center gap-2 rounded-full kym-action px-4 text-sm font-semibold text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : null} Save projects</button>
        </div>
      )}
    </div>
  );
}
