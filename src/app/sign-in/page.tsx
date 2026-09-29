import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() {
  return <main className="grid min-h-screen place-items-center px-5 py-10"><div className="w-full max-w-md">
    <div className="mb-8"><BrandLockup href="/" priority /><p className="mt-4 text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Your inbox. Your career. Your future.</p></div>
    <section className="glass rounded-3xl p-7 sm:p-9"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Owner access</p><h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#F4F7FB]">Welcome back.</h1><p className="mt-3 text-sm leading-6 text-[#93A0B5]">Sign in to your private KYM Mail workspace.</p><SignInForm /><p className="mt-6 text-center text-sm text-[#93A0B5]">Booking a consultation? <Link href="/consult" className="font-semibold text-[#22D3EE]">Open the public booking page</Link></p></section>
  </div></main>;
}
