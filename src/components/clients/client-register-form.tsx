"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function ClientRegisterForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/clients/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.get("fullName"),
        email: form.get("email"),
        clientNumber: form.get("clientNumber"),
        password: form.get("password"),
        website: form.get("website") ?? ""
      })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Registration could not be completed.");
    router.push("/client");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#E8E2E3] bg-white p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-8">
      <div className="absolute -left-[9999px]" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <div className="grid gap-5">
        <label className="text-sm font-semibold text-[#183A5A]">Name<input name="fullName" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
        <label className="text-sm font-semibold text-[#183A5A]">Email<input name="email" required type="email" maxLength={254} autoComplete="email" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
        <label className="text-sm font-semibold text-[#183A5A]">Client number<input name="clientNumber" required placeholder="KYM-482193" autoComplete="off" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal uppercase outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
        <label className="text-sm font-semibold text-[#183A5A]">Password<input name="password" required type="password" minLength={8} maxLength={128} autoComplete="new-password" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      </div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Creating access…</> : "Create client access"}</button>
    </form>
  );
}
