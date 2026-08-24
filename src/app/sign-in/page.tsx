import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() {
  return <main className="grid min-h-screen place-items-center px-5 py-10"><div className="w-full max-w-md">
    <div className="mb-7 flex items-center gap-3"><span className="brand-mark grid size-11 place-items-center rounded-2xl text-white"><Mail className="size-5" /></span><div><p className="font-semibold tracking-tight text-[#183A5A]">KYM <span className="signature-gradient">Mail</span></p><p className="text-xs text-[#64748B]">Private outreach workspace</p></div></div>
    <section className="glass rounded-3xl p-7 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Owner access</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#183A5A]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-[#64748B]">Sign in to your private KYM Mail workspace.</p><SignInForm /></section>
  </div></main>;
}
