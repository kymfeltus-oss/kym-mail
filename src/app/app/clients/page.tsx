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
        <header className="mb-8"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Client portal</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#183A5A] sm:text-5xl">Paying clients.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#64748B]">Issue a client number, then manage payments, job status, and 15-minute sessions.</p></header>
        <CreateClientForm />
        <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#183A5A]">Client list</h2>
          {clients?.length ? <div className="mt-5 divide-y divide-[#E8E2E3]">{clients.map((item) => <Link key={item.id} href={`/app/clients/${item.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-[#183A5A]">{item.full_name}</p><p className="mt-1 text-xs text-[#64748B]">{item.client_number} · {item.email}</p></div><span className="rounded-full bg-[#F8F5F4] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#526173]">{item.registered_at ? "Registered" : "Invited"}{item.is_active ? "" : " · Inactive"}</span></Link>)}</div> : <p className="mt-4 text-sm text-[#64748B]">No paying clients yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
