import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { z } from "zod";
import { AppShell } from "@/components/app-shell";
import { CreateJobForm, ClientEditForm, JobStatusForm, RecordPaymentForm } from "@/components/clients/owner-client-forms";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatClientAmount, jobStatusLabels, paymentStatusLabels } from "@/lib/clients/validation";
import type { ClientJob, ClientJobUpdate, ClientPayment, ClientSessionBooking } from "@/lib/clients/types";

export const metadata = { title: "Client detail" };

function time(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function OwnerClientDetailPage({ params }: { params: Promise<{ clientId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { clientId } = await params;
  if (!z.string().uuid().safeParse(clientId).success) notFound();
  const { data: client } = await owner.database.from("clients").select("id, client_number, full_name, email, phone, is_active, registered_at").eq("id", clientId).eq("owner_id", owner.user.id).maybeSingle();
  if (!client) notFound();
  const [{ data: payments }, { data: jobs }, { data: bookings }] = await Promise.all([
    owner.database.from("client_payments").select("id, amount_cents, status, note, occurred_at").eq("client_id", client.id).order("occurred_at", { ascending: false }),
    owner.database.from("client_jobs").select("id, title, status, created_at, updated_at").eq("client_id", client.id).order("updated_at", { ascending: false }),
    owner.database.from("client_session_bookings").select("id, duration_minutes, status, booking_start_at, booking_end_at, booking_timezone, booking_title, created_at").eq("client_id", client.id).order("created_at", { ascending: false })
  ]);
  const jobRows = (jobs ?? []) as ClientJob[];
  const updatesByJob = new Map<string, ClientJobUpdate[]>();
  if (jobRows.length) {
    const { data: updates } = await owner.database.from("client_job_updates").select("id, job_id, body, created_at").in("job_id", jobRows.map((job) => job.id)).order("created_at", { ascending: false });
    for (const update of (updates ?? []) as ClientJobUpdate[]) {
      const current = updatesByJob.get(update.job_id) ?? [];
      if (current.length < 6) updatesByJob.set(update.job_id, [...current, update]);
    }
  }

  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="clients">
      <div className="mx-auto max-w-6xl">
        <Link href="/app/clients" className="text-sm font-semibold text-[#A73D52]">All clients</Link>
        <header className="mt-4"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">{client.client_number}</p><h1 className="mt-2 text-3xl font-semibold text-[#183A5A]">{client.full_name}</h1><p className="mt-2 text-sm text-[#64748B]">{client.email}{client.phone ? ` · ${client.phone}` : ""} · {client.registered_at ? "Registered" : "Invitation pending"}</p></header>
        <ClientEditForm clientId={client.id} fullName={client.full_name} email={client.email} phone={client.phone} isActive={client.is_active} />

        <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#183A5A]">Payments</h2>
          <RecordPaymentForm clientId={client.id} />
          {(payments as ClientPayment[] | null)?.length ? <div className="mt-5 divide-y divide-[#E8E2E3]">{(payments as ClientPayment[]).map((payment) => <div key={payment.id} className="flex flex-wrap justify-between gap-3 py-3"><div><p className="font-semibold text-[#183A5A]">{formatClientAmount(payment.amount_cents)}</p><p className="text-xs text-[#64748B]">{time(payment.occurred_at)}{payment.note ? ` · ${payment.note}` : ""}</p></div><span className="text-xs font-semibold text-[#526173]">{paymentStatusLabels[payment.status]}</span></div>)}</div> : <p className="mt-4 text-sm text-[#64748B]">No payments recorded.</p>}
        </section>

        <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#183A5A]">Jobs and status updates</h2>
          <CreateJobForm clientId={client.id} />
          {jobRows.length ? <div className="mt-6 space-y-5">{jobRows.map((job) => <article key={job.id} className="rounded-2xl border border-[#E8E2E3] p-4"><p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#7A8795]">{jobStatusLabels[job.status]}</p><JobStatusForm clientId={client.id} jobId={job.id} title={job.title} status={job.status} />{updatesByJob.get(job.id)?.length ? <ol className="mt-4 space-y-2">{updatesByJob.get(job.id)!.map((update) => <li key={update.id} className="text-sm text-[#526173]"><time className="block text-[11px] text-[#94A3B8]">{time(update.created_at)}</time>{update.body}</li>)}</ol> : null}</article>)}</div> : <p className="mt-4 text-sm text-[#64748B]">No jobs yet.</p>}
        </section>

        <section className="mt-8 rounded-3xl border border-[#E8E2E3] bg-white p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#183A5A]">15-minute sessions</h2>
          {(bookings as ClientSessionBooking[] | null)?.length ? <div className="mt-4 space-y-3">{(bookings as ClientSessionBooking[]).map((item) => <article key={item.id} className="rounded-2xl border border-[#EEE8E8] px-4 py-3"><p className="text-sm font-semibold text-[#183A5A]">{item.booking_title ?? "15-minute client session"}</p><p className="mt-1 text-xs text-[#64748B]">{item.booking_start_at ? time(item.booking_start_at) : time(item.created_at)} · {item.status}</p></article>)}</div> : <p className="mt-4 text-sm text-[#64748B]">No 15-minute sessions yet.</p>}
        </section>
      </div>
    </AppShell>
  );
}
