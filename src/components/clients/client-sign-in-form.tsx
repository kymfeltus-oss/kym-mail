"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function ClientSignInForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/clients/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(body.error ?? "Sign-in failed.");
    router.push("/client");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-[#E8E2E3] bg-white p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-8">
      <div className="grid gap-5">
        <label className="text-sm font-semibold text-[#183A5A]">Email<input name="email" required type="email" autoComplete="email" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
        <label className="text-sm font-semibold text-[#183A5A]">Password<input name="password" required type="password" minLength={8} autoComplete="current-password" className="mt-2 w-full rounded-2xl border border-[#D8D5D6] px-4 py-3 font-normal outline-none focus:border-[#D95B72] focus:ring-4 focus:ring-[#F7DDE1]" /></label>
      </div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#D95B72] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">{busy ? <><LoaderCircle className="size-4 animate-spin" /> Signing in…</> : "Enter client dashboard"}</button>
    </form>
  );
}
