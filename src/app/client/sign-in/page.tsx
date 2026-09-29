import Link from "next/link";
import { ClientSignInForm } from "@/components/clients/client-sign-in-form";
import { ClientChrome } from "@/components/clients/client-chrome";

export const metadata = { title: "Client sign in" };

export default function ClientSignInPage() {
  return (
    <ClientChrome action={<Link href="/client/register">Register with your client number</Link>}>
      <section className="mx-auto mt-12 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Paying clients</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Welcome back.</h1>
        <p className="mt-4 text-sm leading-6 text-[#93A0B5]">Sign in to book a 15-minute session, review payments, and see job status updates.</p>
        <div className="mt-8"><ClientSignInForm /></div>
      </section>
    </ClientChrome>
  );
}
