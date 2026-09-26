"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent, type FormEvent } from "react";
import { FileUp, LoaderCircle } from "lucide-react";
import { readApiJson } from "@/lib/http/read-api-json";

export function ResumeTargetIntake() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [employer, setEmployer] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function readDroppedFile(file: File) {
    if (!file.type.startsWith("text/") && !file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      setError("Drop a text file, or paste the job description.");
      return;
    }
    setDescription((await file.text()).slice(0, 30000));
    setError(null);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void readDroppedFile(file);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/resumes/targets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, employer, description })
      });
      const payload = await readApiJson<{ targetId?: string; error?: string }>(response);
      if (!response.ok || !payload.targetId) throw new Error(payload.error ?? "The targeted resume could not be created.");
      router.push(`/app/resumes/targets/${payload.targetId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The targeted resume could not be created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 rounded-[2rem] border border-[#E7DBD8] bg-[#FFFDFC] p-5 shadow-[0_24px_80px_rgba(73,24,42,.08)] sm:p-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#3E1D2C]">Role title<input required minLength={2} maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[#E7DBD8] bg-white px-4 font-normal text-[#554850]" /></label>
        <label className="text-sm font-semibold text-[#3E1D2C]">Company<span className="mt-2 block font-normal text-xs text-[#70626A]">Use Confidential Client when the employer is hidden. The studio will try to identify it from the brief.</span><input required minLength={2} maxLength={200} value={employer} onChange={(event) => setEmployer(event.target.value)} className="mt-2 min-h-12 w-full rounded-2xl border border-[#E7DBD8] bg-white px-4 font-normal text-[#554850]" /></label>
      </div>
      <label
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`mt-5 block rounded-[1.75rem] border-2 border-dashed p-5 transition ${dragging ? "border-[#8D2948] bg-[#FFF3F4]" : "border-[#E7DBD8] bg-white"}`}
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-[#3E1D2C]"><FileUp className="size-4 text-[#8D2948]" /> Drop the job description or paste it</p>
        <textarea required minLength={120} maxLength={30000} rows={16} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-3 w-full resize-y rounded-2xl border border-[#E7DBD8] bg-[#FFFDFC] p-4 text-sm leading-7 text-[#554850]" />
      </label>
      {error && <p role="alert" className="mt-4 rounded-2xl bg-[#FFF1F2] p-3 text-sm text-[#A73D52]">{error}</p>}
      <button type="submit" disabled={busy} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#111111] px-6 text-sm font-semibold text-[#F7F1E6] disabled:opacity-60">
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : null}
        Read the brief and ask me about gaps
      </button>
    </form>
  );
}
