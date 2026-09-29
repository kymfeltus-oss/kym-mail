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
      <Link href="/app/scheduled" className="inline-flex items-center gap-2 text-sm font-semibold text-[#93A0B5]"><ArrowLeft className="size-4" /> Scheduled</Link>
      {(flags.scheduled === "true" || flags.updated === "true") && <p role="status" className="mt-5 rounded-2xl border border-[#1D4E89] bg-[#122033] px-5 py-4 text-sm font-semibold text-[#67E8F9]">{flags.updated === "true" ? "Scheduled email updated." : "Email scheduled successfully."}</p>}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-5"><div><span className="rounded-full bg-[#122033] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[#67E8F9]">{scheduledStatusLabels[status]}</span><h1 className="mt-4 text-2xl font-semibold tracking-[-.03em] text-[#F4F7FB] sm:text-4xl">{message.subject}</h1><p className="mt-3 text-sm font-semibold text-[#67E8F9]">{formatScheduledTimestamp(message.scheduled_for, message.timezone)}</p></div>{status === "SCHEDULED" && <Link href={`/app/scheduled/${message.id}/edit`} className="inline-flex items-center gap-2 rounded-full border border-[#1C283C] bg-[#101828] px-5 py-3 text-sm font-semibold text-[#F4F7FB]"><Edit3 className="size-4" /> Edit message</Link>}</header>
      {status === "FAILED" && <div role="alert" className="mt-6 rounded-2xl border border-[#1D4E89] bg-[#122033] p-5"><p className="font-semibold text-[#67E8F9]">Delivery failed</p><p className="mt-2 text-sm leading-6 text-[#93A0B5]">{message.last_error_message || "The provider could not deliver this message."}</p></div>}
      <div className="mt-7 grid min-w-0 gap-7 xl:grid-cols-[1.25fr_.75fr]">
        <article className="min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_14px_42px_rgba(0,0,0,.06)] sm:p-7"><dl className="grid gap-4 border-b border-[#1C283C] pb-5 text-sm"><div><dt className="font-semibold text-[#F4F7FB]">From</dt><dd className="mt-1 break-words text-[#93A0B5]">{identity ? `${identity.email_address} — ${identity.label}` : "Unavailable identity"}</dd></div><div><dt className="font-semibold text-[#F4F7FB]">To</dt><dd className="mt-1 break-words text-[#93A0B5]">{message.to_addresses.join(", ")}</dd></div>{message.cc_addresses.length > 0 && <div><dt className="font-semibold text-[#F4F7FB]">CC</dt><dd className="mt-1 break-words text-[#93A0B5]">{message.cc_addresses.join(", ")}</dd></div>}{message.bcc_addresses.length > 0 && <div><dt className="font-semibold text-[#F4F7FB]">BCC</dt><dd className="mt-1 break-words text-[#93A0B5]">{message.bcc_addresses.join(", ")}</dd></div>}{project && <div><dt className="font-semibold text-[#F4F7FB]">Project</dt><dd className="mt-1"><Link href={`/app/projects/${project.id}`} className="text-[#67E8F9]">{project.name}</Link></dd></div>}</dl><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-[#F4F7FB]">{message.text_body}</p>{(attachments ?? []).length > 0 && <ul className="mt-6 space-y-2 border-t border-[#1C283C] pt-5">{(attachments ?? []).map((attachment) => <li key={attachment.id}><a href={`/api/scheduled/${message.id}/attachments/${attachment.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-[#67E8F9]"><Paperclip className="size-3.5" /> {attachment.filename} · {(Number(attachment.size_bytes) / 1024).toFixed(1)} KB</a></li>)}</ul>}</article>
        <aside className="min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 sm:p-6"><h2 className="text-lg font-semibold text-[#F4F7FB]">Schedule activity</h2>{events?.length ? <ol className="mt-4 space-y-4">{events.map((event) => <li key={event.id} className="border-l-2 border-[#164E63] pl-4"><p className="text-sm font-semibold text-[#F4F7FB]">{scheduledEventLabels[event.event_type] ?? "Schedule updated"}</p><time className="mt-1 block text-[11px] text-[#93A0B5]">{formatMailTimestamp(event.occurred_at)}</time></li>)}</ol> : <p className="mt-3 text-sm text-[#93A0B5]">No scheduling activity recorded.</p>}</aside>
      </div>
      <ScheduledMessageActions id={message.id} status={message.status} version={message.version} scheduledFor={message.scheduled_for} />
    </div>
  </AppShell>;
}
