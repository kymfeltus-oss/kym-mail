"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { jobStatusLabels, paymentStatusLabels } from "@/lib/clients/validation";

const fieldClass = "mt-2 w-full rounded-xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72]";

export function CreateClientForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdNumber, setCreatedNumber] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setCreatedNumber(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/owner/clients", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fullName: form.get("fullName"), email: form.get("email"), phone: form.get("phone") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string; client?: { client_number: string } };
    setBusy(false);
    if (!response.ok || !body.client) return setError(body.error ?? "The client could not be created.");
    setCreatedNumber(body.client.client_number);
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold text-[#183A5A]">Invite a paying client</h2>
      <p className="mt-2 text-sm text-[#64748B]">Creates a client number they will use to register and book 15-minute sessions.</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold text-[#183A5A]">Name<input name="fullName" required minLength={2} className={fieldClass} /></label>
        <label className="text-sm font-semibold text-[#183A5A]">Email<input name="email" required type="email" className={fieldClass} /></label>
        <label className="text-sm font-semibold text-[#183A5A] sm:col-span-2">Phone <span className="font-normal text-[#7A8795]">(optional)</span><input name="phone" className={fieldClass} /></label>
      </div>
      {createdNumber && <p role="status" className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Client number assigned: <strong>{createdNumber}</strong></p>}
      {error && <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Saving…</> : "Create client"}</button>
    </form>
  );
}

export function RecordPaymentForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const dollars = Number(form.get("amount"));
    const response = await fetch(`/api/owner/clients/${clientId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: Math.round(dollars * 100), status: form.get("status"), note: form.get("note") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Payment could not be recorded.");
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-3">
      <label className="text-sm font-semibold text-[#183A5A]">Amount (USD)<input name="amount" required type="number" min="0.01" step="0.01" className={fieldClass} /></label>
      <label className="text-sm font-semibold text-[#183A5A]">Status<select name="status" className={fieldClass}>{Object.entries(paymentStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="text-sm font-semibold text-[#183A5A]">Note<input name="note" maxLength={500} className={fieldClass} /></label>
      {error && <p role="alert" className="sm:col-span-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="sm:col-span-3"><button disabled={busy} className="rounded-full bg-[#183A5A] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Record payment"}</button></div>
    </form>
  );
}

export function CreateJobForm({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/owner/clients/${clientId}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), status: form.get("status") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Job could not be created.");
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_auto]">
      <label className="text-sm font-semibold text-[#183A5A]">Job title<input name="title" required minLength={2} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-[#183A5A]">Status<select name="status" defaultValue="INTAKE" className={fieldClass}>{Object.entries(jobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button disabled={busy} className="self-end rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Add job"}</button>
      {error && <p role="alert" className="sm:col-span-3 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </form>
  );
}

export function ClientEditForm({ clientId, fullName, email, phone, isActive }: { clientId: string; fullName: string; email: string; phone: string | null; isActive: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/owner/clients/${clientId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        email: form.get("email"),
        phone: form.get("phone"),
        isActive: form.get("isActive") === "on"
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return setError(body.error ?? "The client could not be updated.");
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="mt-6 grid gap-4 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:grid-cols-2 sm:p-7">
      <label className="text-sm font-semibold text-[#183A5A]">Name<input name="fullName" required defaultValue={fullName} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-[#183A5A]">Email<input name="email" required type="email" defaultValue={email} className={fieldClass} /></label>
      <label className="text-sm font-semibold text-[#183A5A]">Phone<input name="phone" defaultValue={phone ?? ""} className={fieldClass} /></label>
      <label className="flex items-center gap-3 self-end text-sm font-semibold text-[#183A5A]"><input name="isActive" type="checkbox" defaultChecked={isActive} className="size-4 accent-[#D95B72]" /> Client access is active</label>
      {error && <p role="alert" className="sm:col-span-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="sm:col-span-2"><button className="rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white">Save client</button></div>
    </form>
  );
}

export function JobStatusForm({ clientId, jobId, title, status }: { clientId: string; jobId: string; title: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function saveJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/owner/clients/${clientId}/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: form.get("title"), status: form.get("status") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Job could not be updated.");
    router.refresh();
  }

  async function addUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/owner/clients/${clientId}/jobs/${jobId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: form.get("body") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Status update could not be saved.");
    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <form onSubmit={saveJob} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <input name="title" required defaultValue={title} className={fieldClass} />
        <select name="status" defaultValue={status} className={fieldClass}>{Object.entries(jobStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="rounded-full border border-[#E7B8C1] px-4 py-3 text-sm font-semibold text-[#A73D52]">Save job</button>
      </form>
      <form onSubmit={addUpdate} className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input name="body" required maxLength={1000} placeholder="Status update for the client dashboard" className={fieldClass} />
        <button className="rounded-full bg-[#183A5A] px-4 py-3 text-sm font-semibold text-white">Add update</button>
      </form>
      {error && <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
