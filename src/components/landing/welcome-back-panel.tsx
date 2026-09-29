"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

const rememberedEmailKey = "kym-client-email";

export function WelcomeBackPanel() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(rememberedEmailKey);
    if (!saved) return;
    setEmail(saved);
    setRemember(true);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("email") ?? "");
    const response = await fetch("/api/clients/sign-in", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail, password: form.get("password") })
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) {
      setBusy(false);
      setError(body.error ?? "Sign-in failed.");
      return;
    }
    if (remember) window.localStorage.setItem(rememberedEmailKey, nextEmail);
    else window.localStorage.removeItem(rememberedEmailKey);
    router.push("/client");
    router.refresh();
  }

  return (
    <article id="account" className="w-full max-w-[385px] rounded-2xl border border-[#67E8F9]/35 bg-[#070D18]/75 p-4 shadow-[0_0_36px_rgba(139,92,246,.22)] backdrop-blur-md">
      <h2 className="text-lg font-semibold tracking-[-.03em] text-white">Welcome Back</h2>
      <p className="mt-1 text-xs leading-4 text-[#C5D0E0]">Sign in to access your workspace, email, projects, and more.</p>
      <form onSubmit={submit} className="mt-3">
        <label className="block text-[11px] font-semibold text-[#F4F7FB]" htmlFor="account-email">Email
          <input id="account-email" name="email" required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-[#243044] bg-[#0b1220]/90 px-3 py-2 text-sm font-normal outline-none transition focus:border-[#22D3EE] focus:shadow-[0_0_0_3px_rgba(34,211,238,.28)]" />
        </label>
        <label className="mt-2.5 block text-[11px] font-semibold text-[#F4F7FB]" htmlFor="account-password">Password
          <span className="relative mt-1 block">
            <input id="account-password" name="password" required minLength={8} autoComplete="current-password" type={showPassword ? "text" : "password"} className="w-full rounded-lg border border-[#243044] bg-[#0b1220]/90 px-3 py-2 pr-10 text-sm font-normal outline-none transition focus:border-[#22D3EE] focus:shadow-[0_0_0_3px_rgba(34,211,238,.28)]" />
            <button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-[#93A0B5] transition hover:text-[#67E8F9]">
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </label>
        <div className="mt-2.5 flex items-center justify-between gap-3 text-[11px]">
          <label className="flex items-center gap-2 font-semibold text-[#C5D0E0]"><input name="remember" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-3.5 accent-[#22D3EE]" /> Remember me</label>
          <a href="mailto:kym@kymmailapp.com?subject=KYM%20Mail%20client%20password%20help" className="font-semibold text-[#67E8F9] underline decoration-[#22D3EE]/40 underline-offset-2 transition hover:decoration-[#D946EF]">Forgot password?</a>
        </div>
        {error ? <p role="alert" className="mt-2 rounded-lg bg-[#2A1218] px-3 py-2 text-xs text-[#FB7185]">{error}</p> : null}
        <button disabled={busy} className="kym-action mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(34,211,238,.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] active:translate-y-0 active:scale-[.99] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none">
          {busy ? <><LoaderCircle className="size-4 animate-spin" /> Signing in…</> : "Sign In"}
        </button>
      </form>
      <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#93A0B5]"><span className="h-px flex-1 bg-white/15" />or<span className="h-px flex-1 bg-white/15" /></div>
      <Link href="/client/register" className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-[#67E8F9]/40 px-4 py-2 text-sm font-semibold text-[#67E8F9] transition duration-200 hover:-translate-y-0.5 hover:border-[#D946EF]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] active:translate-y-0 motion-reduce:transform-none">Create Account</Link>
    </article>
  );
}
