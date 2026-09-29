"use client";

import { useActionState } from "react";
import { ArrowRight, LoaderCircle, LockKeyhole } from "lucide-react";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initialState);
  return <form action={action} className="mt-9 space-y-5" noValidate>
    <div><label htmlFor="email" className="mb-2 block text-sm font-medium text-[#F4F7FB]">Email address</label><input id="email" name="email" type="email" autoComplete="email" defaultValue={state.fields?.email} required className="w-full rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3.5 text-[#F4F7FB] shadow-sm placeholder:text-[#93A0B5]/55" placeholder="you@example.com" /></div>
    <div><label htmlFor="password" className="mb-2 block text-sm font-medium text-[#F4F7FB]">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} className="w-full rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3.5 text-[#F4F7FB] shadow-sm" /></div>
    {state.message && <p role="alert" className="rounded-xl border border-[#22D3EE]/25 bg-[#122033] px-4 py-3 text-sm text-[#67E8F9]">{state.message}</p>}
    <button disabled={pending} className="group flex w-full items-center justify-center gap-2 rounded-xl kym-action px-4 py-3.5 font-semibold text-white shadow-[0_12px_30px_rgba(37,99,235,.22)] transition  disabled:cursor-wait disabled:opacity-70">
      {pending ? <><LoaderCircle className="size-4 animate-spin" /> Signing in</> : <>Enter workspace <ArrowRight className="size-4 transition group-hover:translate-x-0.5" /></>}
    </button>
    <p className="flex items-center justify-center gap-2 text-xs text-[#93A0B5]"><LockKeyhole className="size-3.5 text-[#22D3EE]" /> Private owner access</p>
  </form>;
}
