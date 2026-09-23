import Link from "next/link";
import { ClientRegisterForm } from "@/components/clients/client-register-form";
import { ClientChrome } from "@/components/clients/client-chrome";

export const metadata = { title: "Client registration" };

export default function ClientRegisterPage() {
  return (
    <ClientChrome action={<Link href="/client/sign-in">Already registered? Sign in</Link>}>
      <section className="mx-auto mt-12 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Paying clients</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-[#183A5A]">Create your client access.</h1>
        <p className="mt-4 text-sm leading-6 text-[#5E6C7D]">Use the client number assigned to you. This dashboard is for people who are already paying clients and need a 15-minute session, payment history, and job updates.</p>
        <div className="mt-8"><ClientRegisterForm /></div>
      </section>
    </ClientChrome>
  );
}
