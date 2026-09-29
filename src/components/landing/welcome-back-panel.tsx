"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { signIn, type SignInState } from "@/app/sign-in/actions";

const initialState: SignInState = {};

export function WelcomeBackPanel() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <article id="account" className="w-full max-w-[385px] rounded-2xl border border-[#67E8F9]/35 bg-[#070D18]/75 p-4 shadow-[0_0_36px_rgba(139,92,246,.22)] backdrop-blur-md">
      <h2 className="text-lg font-semibold tracking-[-.03em] text-white">Welcome Back</h2>
      <p className="mt-1 text-xs leading-4 text-[#C5D0E0]">Enter your PIN to open the private workspace.</p>
      <form action={action} className="mt-3">
        <label className="block text-[11px] font-semibold text-[#F4F7FB]" htmlFor="account-pin">Access PIN
          <input id="account-pin" name="pin" required inputMode="numeric" autoComplete="off" minLength={6} maxLength={6} pattern="[0-9]{6}" type="password" className="mt-1 w-full rounded-lg border border-[#243044] bg-[#0b1220]/90 px-3 py-2 tracking-[.35em] text-sm font-normal outline-none transition focus:border-[#22D3EE] focus:shadow-[0_0_0_3px_rgba(34,211,238,.28)]" />
        </label>
        {state.message ? <p role="alert" className="mt-2 rounded-lg bg-[#2A1218] px-3 py-2 text-xs text-[#FB7185]">{state.message}</p> : null}
        <button disabled={pending} className="kym-action mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(34,211,238,.28)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] active:translate-y-0 active:scale-[.99] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none">
          {pending ? <><LoaderCircle className="size-4 animate-spin" /> Opening…</> : "Enter workspace"}
        </button>
      </form>
      <div className="my-3 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[#93A0B5]"><span className="h-px flex-1 bg-white/15" />or<span className="h-px flex-1 bg-white/15" /></div>
      <Link href="/client/sign-in" className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-[#67E8F9]/40 px-4 py-2 text-sm font-semibold text-[#67E8F9] transition duration-200 hover:-translate-y-0.5 hover:border-[#D946EF]/70 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#22D3EE] active:translate-y-0 motion-reduce:transform-none">Client sign in</Link>
    </article>
  );
}
