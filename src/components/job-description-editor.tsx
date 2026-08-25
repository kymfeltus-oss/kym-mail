"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle } from "lucide-react";

export function JobDescriptionEditor({ jobId, description }: { jobId: string; description: string }) {
  const router = useRouter();
  const [value, setValue] = useState(description);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setPending(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "description", description: value })
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The job description could not be updated.");
      setMessage("Available description saved. Existing match analysis is marked stale if the text changed.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The job description could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-5">
      <label htmlFor="job-description" className="text-sm font-semibold text-[#183A5A]">Complete job description</label>
      <p className="mt-1 text-xs leading-5 text-[#64748B]">Adzuna often supplies a preview. Paste the full posting when you have it so Career Match can evaluate every qualification.</p>
      <textarea
        id="job-description"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        rows={12}
        maxLength={30000}
        className="mt-3 w-full min-w-0 rounded-2xl border border-[#E8E2E3] bg-white p-4 text-sm leading-6 text-[#465B70]"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-[#64748B]">{value.trim().length.toLocaleString()} characters</p>
        <button type="button" disabled={pending} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#183A5A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}
          Save description
        </button>
      </div>
      {message && <p role="status" className="mt-3 text-xs font-semibold text-[#23623E]">{message}</p>}
      {error && <p role="alert" className="mt-3 text-xs text-[#A73D52]">{error}</p>}
    </div>
  );
}
