import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CreateClientForm } from "@/components/clients/owner-client-forms";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Clients" };

export default async function OwnerClientsPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { data: clients, error } = await owner.database.from("clients").select("id, client_number, full_name, email, is_active, registered_at, created_at").eq("owner_id", owner.user.id).order("created_at", { ascending: false });
  if (error) throw new Error("CLIENTS_UNAVAILABLE");
  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="clients">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Client portal</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB] sm:text-5xl">Paying clients.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">Issue a client number, then manage payments, job status, and 15-minute sessions.</p></header>
        <CreateClientForm />
        <section className="mt-8 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#F4F7FB]">Client list</h2>
          {clients?.length ? <div className="mt-5 divide-y divide-[#1C283C]">{clients.map((item) => <Link key={item.id} href={`/app/clients/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-[#F4F7FB]">{item.full_name}</p><p className="mt-1 text-xs text-[#93A0B5]">{item.client_number} · {item.email}</p></div><span className="rounded-full bg-[#05070D] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#93A0B5]">{item.registered_at ? "Registered" : "Invited"}{item.is_active ? "" : " · Inactive"}</span></Link>)}</div> : <p className="mt-4 text-sm text-[#93A0B5]">No paying clients yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
