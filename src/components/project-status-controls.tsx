"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ProjectStatus } from "@/lib/projects/constants";

const labels: Partial<Record<ProjectStatus, string>> = { ACTIVE: "Activate", PAUSED: "Pause", COMPLETED: "Complete", ARCHIVED: "Archive" };

export function ProjectStatusControls({ projectId, status, compact = false }: { projectId: string; status: ProjectStatus; compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<ProjectStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions: ProjectStatus[] = status === "ARCHIVED" ? ["ACTIVE"] : status === "ACTIVE" ? ["PAUSED", "COMPLETED", "ARCHIVED"] : status === "PAUSED" ? ["ACTIVE", "COMPLETED", "ARCHIVED"] : ["ACTIVE", "ARCHIVED"];

  async function update(nextStatus: ProjectStatus) {
    setPending(nextStatus); setError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "status", status: nextStatus }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The status could not be changed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The status could not be changed.");
    } finally { setPending(null); }
  }

  return <div className={compact ? "" : "mt-6"}><div className="flex flex-wrap gap-2">{actions.map((action) => <button key={action} type="button" onClick={() => update(action)} disabled={Boolean(pending)} className={`rounded-full px-4 py-2 text-xs font-semibold transition disabled:opacity-50 ${action === "ARCHIVED" ? "border border-[#E8E2E3] text-[#64748B] hover:bg-[#FFF3F4]" : action === "ACTIVE" && status === "ARCHIVED" ? "bg-[#D95B72] text-white" : "border border-[#E7B8C1] bg-[#FFF3F4] text-[#A73D52]"}`}>{pending === action ? "Saving…" : status === "ARCHIVED" && action === "ACTIVE" ? "Restore" : labels[action]}</button>)}</div>{error && <p role="alert" className="mt-2 text-xs font-semibold text-[#A73D52]">{error}</p>}</div>;
}
