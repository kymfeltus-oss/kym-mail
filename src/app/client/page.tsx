import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientChrome } from "@/components/clients/client-chrome";
import { ClientBookingForm } from "@/components/clients/client-booking-form";
import { ClientSignOutButton } from "@/components/clients/client-sign-out-button";
import { getClientContext } from "@/lib/clients/session";
import { formatClientAmount, jobStatusLabels, paymentStatusLabels } from "@/lib/clients/validation";
import type { ClientJob, ClientJobUpdate, ClientPayment, ClientSessionBooking } from "@/lib/clients/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client dashboard" };

function time(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function ClientDashboardPage() {
  const context = await getClientContext();
  if (!context) redirect("/client/sign-in");
  const { client, database } = context;
  const [{ data: payments }, { data: jobs }, { data: bookings }, { data: settings }] = await Promise.all([
    database.from("client_payments").select("id, amount_cents, status, note, occurred_at").eq("client_id", client.id).order("occurred_at", { ascending: false }).limit(25),
    database.from("client_jobs").select("id, title, status, created_at, updated_at").eq("client_id", client.id).order("updated_at", { ascending: false }).limit(25),
    database.from("client_session_bookings").select("id, duration_minutes, status, booking_start_at, booking_end_at, booking_timezone, booking_title, created_at").eq("client_id", client.id).order("created_at", { ascending: false }).limit(10),
    database.from("consultation_settings").select("client_sessions_active, client_session_booking_url").eq("owner_id", client.owner_id).maybeSingle()
  ]);
  const jobRows = (jobs ?? []) as ClientJob[];
  const updatesByJob = new Map<string, ClientJobUpdate[]>();
  if (jobRows.length) {
    const { data: updates } = await database.from("client_job_updates").select("id, job_id, body, created_at").in("job_id", jobRows.map((job) => job.id)).order("created_at", { ascending: false });
    for (const update of (updates ?? []) as ClientJobUpdate[]) {
      const current = updatesByJob.get(update.job_id) ?? [];
      if (current.length < 4) updatesByJob.set(update.job_id, [...current, update]);
    }
  }
  const sessionsOpen = Boolean(settings?.client_sessions_active && settings.client_session_booking_url);

  return (
    <ClientChrome action={<><Link href="/client/book">Book 15 minutes</Link><ClientSignOutButton /></>}>
      <header className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Client dashboard</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] text-[#F4F7FB]">Hello, {client.full_name}.</h1>
        <p className="mt-3 text-sm text-[#93A0B5]">Client number <span className="font-semibold text-[#F4F7FB]">{client.client_number}</span> · {client.email}</p>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5"><p className="text-sm text-[#93A0B5]">Payments</p><p className="mt-2 text-3xl font-semibold text-[#F4F7FB]">{payments?.length ?? 0}</p></div>
        <div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5"><p className="text-sm text-[#93A0B5]">Active jobs</p><p className="mt-2 text-3xl font-semibold text-[#F4F7FB]">{jobRows.filter((job) => !["COMPLETED", "CLOSED"].includes(job.status)).length}</p></div>
        <div className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5"><p className="text-sm text-[#93A0B5]">15-minute sessions</p><p className="mt-2 text-3xl font-semibold text-[#F4F7FB]">{(bookings as ClientSessionBooking[] | null)?.filter((item) => item.status === "BOOKED").length ?? 0}</p></div>
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_.9fr]">
        {sessionsOpen ? <ClientBookingForm clientNumber={client.client_number} /> : <section className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7"><h2 className="text-xl font-semibold text-[#F4F7FB]">15-minute booking</h2><p className="mt-3 text-sm leading-6 text-[#93A0B5]">15-minute client sessions are not open yet. Check back after the owner finishes scheduling setup.</p></section>}
        <section className="rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
          <h2 className="text-xl font-semibold text-[#F4F7FB]">Upcoming and recent sessions</h2>
          {(bookings as ClientSessionBooking[] | null)?.length ? <div className="mt-4 space-y-3">{(bookings as ClientSessionBooking[]).map((item) => <article key={item.id} className="rounded-2xl border border-[#1C283C] px-4 py-3"><p className="text-sm font-semibold text-[#F4F7FB]">{item.booking_title ?? "15-minute client session"}</p><p className="mt-1 text-xs text-[#93A0B5]">{item.booking_start_at ? time(item.booking_start_at) : "Awaiting calendar confirmation"} · {item.status}</p></article>)}</div> : <p className="mt-4 text-sm text-[#93A0B5]">No 15-minute sessions yet.</p>}
        </section>
      </div>

      <section className="mt-8 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-[#F4F7FB]">Payments</h2>
        {(payments as ClientPayment[] | null)?.length ? <div className="mt-4 divide-y divide-[#1C283C]">{(payments as ClientPayment[]).map((payment) => <div key={payment.id} className="flex flex-wrap items-start justify-between gap-3 py-4"><div><p className="font-semibold text-[#F4F7FB]">{formatClientAmount(payment.amount_cents)}</p><p className="mt-1 text-xs text-[#93A0B5]">{time(payment.occurred_at)}{payment.note ? ` · ${payment.note}` : ""}</p></div><span className="rounded-full bg-[#05070D] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#93A0B5]">{paymentStatusLabels[payment.status]}</span></div>)}</div> : <p className="mt-4 text-sm text-[#93A0B5]">No payments have been recorded yet.</p>}
      </section>

      <section className="mt-8 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-7">
        <h2 className="text-xl font-semibold text-[#F4F7FB]">Jobs and status updates</h2>
        {jobRows.length ? <div className="mt-5 space-y-4">{jobRows.map((job) => <article key={job.id} className="rounded-2xl border border-[#1C283C] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><h3 className="font-semibold text-[#F4F7FB]">{job.title}</h3><span className="rounded-full bg-[#122033] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#67E8F9]">{jobStatusLabels[job.status]}</span></div>{updatesByJob.get(job.id)?.length ? <ol className="mt-4 space-y-2">{updatesByJob.get(job.id)!.map((update) => <li key={update.id} className="text-sm leading-6 text-[#93A0B5]"><time className="block text-[11px] text-[#93A0B5]">{time(update.created_at)}</time>{update.body}</li>)}</ol> : <p className="mt-3 text-sm text-[#93A0B5]">No status updates yet.</p>}</article>)}</div> : <p className="mt-4 text-sm text-[#93A0B5]">No jobs have been assigned yet.</p>}
      </section>
    </ClientChrome>
  );
}
