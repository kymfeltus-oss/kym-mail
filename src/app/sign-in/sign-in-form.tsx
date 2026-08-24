"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <form action={action} className="mt-9 space-y-5" noValidate>
    <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-[#183A5A]">Email address</label><input id="email" name="email" type="email" autoComplete="email" defaultValue={state.fields?.email} required className="w-full rounded-xl border border-[#E8E2E3] bg-white px-4 py-3.5 text-[#183A5A] shadow-sm placeholder:text-[#64748B]/55" placeholder="you@example.com" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm font-medium text-[#183A5A]">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="w-full rounded-xl border border-[#E8E2E3] bg-white px-4 py-3.5 text-[#183A5A] shadow-sm" /></div>
    {state.message && <p role="alert" className="rounded-xl border border-[#D95B72]/25 bg-[#FFF3F4] px-4 py-3 text-sm text-[#9F3449]">{state.message}</p>}
    <button disabled={pending} className="group flex w-full items-center justify-center gap-2 rounded-xl bg-[#D95B72] px-4 py-3.5 font-semibold text-white shadow-[0_12px_30px_rgba(217,91,114,.22)] transition hover:bg-[#C94D65] disabled:cursor-wait disabled:opacity-70">
      {pending ? <><LoaderCircle className="size-4 animate-spin" /> Signing in</> : <>Enter workspace <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></>}
    </button>
    <p className="flex items-center justify-center gap-2 text-xs text-[#64748B]"><LockKeyhole className="size-3.5 text-[#D95B72]" /> Private owner access</p>
  </form>;
}
