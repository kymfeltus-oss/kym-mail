import Link from "next/link";
import { ClientRegisterForm } from "@/components/clients/client-register-form";
import { ClientChrome } from "@/components/clients/client-chrome";

export const metadata = { title: "Client registration" };

export default function ClientRegisterPage() {
  return (
    <ClientChrome action={<Link href="/client/sign-in">Already registered? Sign in</Link>}>
      <section className="mx-auto mt-12 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Paying clients</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Create your client access.</h1>
        <p className="mt-4 text-sm leading-6 text-[#93A0B5]">Use the client number assigned to you. This dashboard is for people who are already paying clients and need a 15-minute session, payment history, and job updates.</p>
        <div className="mt-8"><ClientRegisterForm /></div>
      </section>
    </ClientChrome>
  );
}
