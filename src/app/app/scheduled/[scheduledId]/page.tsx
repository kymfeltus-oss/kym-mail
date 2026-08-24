import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Edit3, Paperclip } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScheduledMessageActions } from "@/components/scheduled-message-actions";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatMailTimestamp, formatScheduledTimestamp } from "@/lib/mail/date-format";
import { scheduledEventLabels, scheduledStatusLabels, type ScheduledStatus } from "@/lib/scheduling/constants";

export const metadata = { title: "Scheduled email" };

export default async function ScheduledMessagePage({ params, searchParams }: { params: Promise<{ scheduledId: string }>; searchParams: Promise<{ scheduled?: string; updated?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { scheduledId } = await params;
  const { data: message, error } = await owner.database.from("scheduled_messages").select("*").eq("id", scheduledId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("SCHEDULED_MAIL_UNAVAILABLE");
  if (!message) notFound();
  const [{ data: identity }, { data: project }, { data: attachments }, { data: events }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address, label, is_active, send_as_state").eq("id", message.mail_account_id).eq("owner_id", owner.user.id).maybeSingle(),
    message.project_id ? owner.database.from("projects").select("id, name").eq("id", message.project_id).eq("owner_id", owner.user.id).maybeSingle() : Promise.resolve({ data: null }),
    owner.database.from("scheduled_message_attachments").select("id, filename, mime_type, size_bytes").eq("scheduled_message_id", message.id).eq("owner_id", owner.user.id).order("created_at"),
    owner.database.from("scheduled_message_events").select("id, event_type, details, occurred_at").eq("scheduled_message_id", message.id).eq("owner_id", owner.user.id).order("occurred_at", { ascending: false })
  ]);
  const status = message.status as ScheduledStatus;
  const flags = await searchParams;
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="scheduled">
    <div className="mx-auto max-w-5xl">
      <Link href="/app/scheduled" className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> Scheduled</Link>
      {(flags.scheduled === "true" || flags.updated === "true") && <p role="status" className="mt-5 rounded-2xl border border-[#E7B8C1] bg-[#FFF3F4] px-5 py-4 text-sm font-semibold text-[#A73D52]">{flags.updated === "true" ? "Scheduled email updated." : "Email scheduled successfully."}</p>}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><span className="rounded-full bg-[#FFF3F4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#A73D52]">{scheduledStatusLabels[status]}</span><h1 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">{message.subject}</h1><p className="mt-3 text-sm font-semibold text-[#A73D52]">{formatScheduledTimestamp(message.scheduled_for, message.timezone)}</p></div>{status === "SCHEDULED" && <Link href={`/app/scheduled/${message.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] bg-[#FFFCFB] px-5 py-3 text-sm font-semibold text-[#183A5A]"><Edit3 className="size-4" /> Edit message</Link>}</header>
      {status === "FAILED" && <div role="alert" className="mt-6 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] p-5"><p className="font-semibold text-[#A73D52]">Delivery failed</p><p className="mt-2 text-sm leading-6 text-[#64748B]">{message.last_error_message || "The provider could not deliver this message."}</p></div>}
      <div className="mt-7 grid min-w-0 gap-7 xl:grid-cols-[1.25fr_.75fr]">
        <article className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7"><dl className="grid gap-4 border-b border-[#E8E2E3] pb-5 text-sm"><div><dt className="font-semibold text-[#183A5A]">From</dt><dd className="mt-1 break-words text-[#64748B]">{identity ? `${identity.email_address} — ${identity.label}` : "Unavailable identity"}</dd></div><div><dt className="font-semibold text-[#183A5A]">To</dt><dd className="mt-1 break-words text-[#64748B]">{message.to_addresses.join(", ")}</dd></div>{message.cc_addresses.length > 0 && <div><dt className="font-semibold text-[#183A5A]">CC</dt><dd className="mt-1 break-words text-[#64748B]">{message.cc_addresses.join(", ")}</dd></div>}{message.bcc_addresses.length > 0 && <div><dt className="font-semibold text-[#183A5A]">BCC</dt><dd className="mt-1 break-words text-[#64748B]">{message.bcc_addresses.join(", ")}</dd></div>}{project && <div><dt className="font-semibold text-[#183A5A]">Project</dt><dd className="mt-1"><Link href={`/app/projects/${project.id}`} className="text-[#A73D52]">{project.name}</Link></dd></div>}</dl><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[#243B53]">{message.text_body}</p>{(attachments ?? []).length > 0 && <ul className="mt-6 space-y-2 border-t border-[#E8E2E3] pt-5">{(attachments ?? []).map((attachment) => <li key={attachment.id}><a href={`/api/scheduled/${message.id}/attachments/${attachment.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-[#A73D52]"><Paperclip className="size-3.5" /> {attachment.filename} · {(Number(attachment.size_bytes) / 1024).toFixed(1)} KB</a></li>)}</ul>}</article>
        <aside className="min-w-0 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#183A5A]">Schedule activity</h2>{events?.length ? <ol className="mt-4 space-y-4">{events.map((event) => <li key={event.id} className="border-l-2 border-[#F7DDE1] pl-4"><p className="text-sm font-semibold text-[#183A5A]">{scheduledEventLabels[event.event_type] ?? "Schedule updated"}</p><time className="mt-1 block text-[11px] text-[#94A3B8]">{formatMailTimestamp(event.occurred_at)}</time></li>)}</ol> : <p className="mt-3 text-sm text-[#64748B]">No scheduling activity recorded.</p>}</aside>
      </div>
      <ScheduledMessageActions id={message.id} status={message.status} version={message.version} scheduledFor={message.scheduled_for} />
    </div>
  </AppShell>;
}
