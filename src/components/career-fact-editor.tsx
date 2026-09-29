"use client";

import { useState, type FormEvent } from "react";
import { Check, LoaderCircle, PencilLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CareerEditableEntity } from "@/lib/career/editing";

type EditorValue = string | number | boolean | null;
type FieldOption = { label: string; value: string };
export type CareerEditorField = {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "date" | "select" | "checkbox" | "number";
  options?: FieldOption[];
  placeholder?: string;
};

export function CareerFactEditor({ entityType, recordId, title, fields, initialValues, compact = false }: {
  entityType: CareerEditableEntity;
  recordId: string;
  title: string;
  fields: CareerEditorField[];
  initialValues: Record<string, EditorValue>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function close() {
    if (pending) return;
    setOpen(false);
    setValues(initialValues);
    setMessage(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/career/${entityType}/${recordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changes: values })
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The career record could not be updated.");
      setMessage("Saved as owner-confirmed evidence.");
      router.refresh();
      window.setTimeout(() => setOpen(false), 650);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The career record could not be updated.");
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className={compact
      ? "inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-[#1C283C] bg-[#101828] text-[#67E8F9] transition hover:border-[#22D3EE] hover:bg-[#122033]"
      : "inline-flex items-center gap-2 rounded-full border border-[#1D4E89] bg-[#101828] px-4 py-2 text-xs font-semibold text-[#67E8F9] transition hover:border-[#22D3EE] hover:bg-[#122033]"}
      aria-label={`Edit ${title}`}>
      <PencilLine className="size-3.5" />{!compact && "Edit"}
    </button>
    {open && <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[#0E1C33]/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Edit ${title}`} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-[#101828] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#22D3EE]">Owner-confirmed career fact</p><h2 className="mt-2 text-2xl font-semibold text-[#F4F7FB]">{title}</h2><p className="mt-2 text-sm leading-6 text-[#93A0B5]">Saving creates an immutable history entry and marks this record as resolved owner evidence.</p></div><button type="button" onClick={close} className="inline-flex size-9 items-center justify-center rounded-full border border-[#1C283C] text-[#93A0B5]" aria-label="Close editor"><X className="size-4" /></button></div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">{fields.map((field) => {
          const value = values[field.key];
          const shared = { id: `career-${entityType}-${recordId}-${field.key}`, name: field.key };
          if (field.kind === "checkbox") return <label key={field.key} className="flex items-center gap-3 rounded-2xl border border-[#1C283C] p-4 text-sm font-semibold text-[#F4F7FB] sm:col-span-2"><input {...shared} type="checkbox" checked={Boolean(value)} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.checked }))} className="size-4 accent-[#22D3EE]" />{field.label}</label>;
          return <label key={field.key} htmlFor={shared.id} className={`block ${field.kind === "textarea" ? "sm:col-span-2" : ""}`}><span className="text-xs font-semibold uppercase tracking-[.08em] text-[#93A0B5]">{field.label}</span>
            {field.kind === "textarea" ? <textarea {...shared} value={String(value ?? "")} placeholder={field.placeholder} rows={5} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#101828] px-4 py-3 text-sm leading-6 text-[#F4F7FB] outline-none focus:border-[#22D3EE]" />
              : field.kind === "select" ? <select {...shared} value={String(value ?? "")} onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value || null }))} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#101828] px-4 py-3 text-sm text-[#F4F7FB] outline-none focus:border-[#22D3EE]"><option value="">Not provided</option>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                : <input {...shared} type={field.kind === "date" ? "date" : field.kind === "number" ? "number" : "text"} value={value === null ? "" : String(value)} placeholder={field.placeholder} onChange={(event) => setValues((current) => ({ ...current, [field.key]: field.kind === "number" ? (event.target.value === "" ? null : Number(event.target.value)) : event.target.value }))} className="mt-2 w-full rounded-2xl border border-[#1C283C] bg-[#101828] px-4 py-3 text-sm text-[#F4F7FB] outline-none focus:border-[#22D3EE]" />}
          </label>;
        })}</div>
        {message && <p className={`mt-5 rounded-2xl px-4 py-3 text-sm ${message.startsWith("Saved") ? "bg-[#0C241C] text-[#34D399]" : "bg-[#2A1218] text-[#FB7185]"}`}>{message}</p>}
        <div className="mt-7 flex justify-end gap-3"><button type="button" onClick={close} disabled={pending} className="rounded-full border border-[#1C283C] px-5 py-2.5 text-sm font-semibold text-[#93A0B5]">Cancel</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full kym-action px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.24)] disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save fact</button></div>
      </form>
    </div>}
  </>;
}
