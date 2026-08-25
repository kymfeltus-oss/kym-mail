"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, LoaderCircle } from "lucide-react";

export function SavedJobActions({ jobId, redirectAfter = false }: { jobId: string; redirectAfter?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function archive() {
    if (!window.confirm("Remove this opportunity from Saved Jobs? Its authoritative record will be archived.")) return;
    setPending(true); setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "status", status: "ARCHIVED" }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The saved job could not be removed.");
      if (redirectAfter) router.push("/app/jobs/saved"); else router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The saved job could not be removed."); }
    finally { setPending(false); }
  }
  return <div><button type="button" disabled={pending} onClick={() => void archive()} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#A73D52] disabled:opacity-50">{pending ? <LoaderCircle className="size-3.5 animate-spin" /> : <Archive className="size-3.5" />} Remove from Saved</button>{error && <p role="alert" className="mt-2 text-xs text-[#A73D52]">{error}</p>}</div>;
}

export function JobProjectManager({ jobId, projects, selectedProjectIds }: { jobId: string; projects: { id: string; name: string }[]; selectedProjectIds: string[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(selectedProjectIds);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function toggle(projectId: string) { setSelected((current) => current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId]); }
  async function save() {
    setPending(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "projects", projectIds: selected }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Project associations could not be updated.");
      setMessage("Project associations updated."); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Project associations could not be updated."); }
    finally { setPending(false); }
  }
  return <div><div className="mt-4 grid gap-2 sm:grid-cols-2">{projects.map((project) => <label key={project.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm font-semibold transition ${selected.includes(project.id) ? "border-[#E7B8C1] bg-[#FFF3F4] text-[#183A5A]" : "border-[#E8E2E3] text-[#64748B]"}`}><input type="checkbox" checked={selected.includes(project.id)} onChange={() => toggle(project.id)} className="size-4 accent-[#D95B72]" />{project.name}</label>)}</div>{!projects.length && <p className="mt-3 text-sm text-[#64748B]">No active Job Search Projects are available. This opportunity remains in Saved Jobs without a Project.</p>}<button type="button" disabled={pending} onClick={() => void save()} className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save Project associations</button>{message && <p role="status" className="mt-3 text-xs font-semibold text-[#23623E]">{message}</p>}{error && <p role="alert" className="mt-3 text-xs text-[#A73D52]">{error}</p>}</div>;
}
