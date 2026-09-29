import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, Paperclip } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatScheduledTimestamp } from "@/lib/mail/date-format";
import { scheduledStatusLabels, type ScheduledStatus } from "@/lib/scheduling/constants";

export const metadata = { title: "Scheduled" };

export default async function ScheduledPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const view = (await searchParams).view === "history" ? "history" : "upcoming";
  let query = owner.database.from("scheduled_messages").select("id, mail_account_id, project_id, to_addresses, subject, scheduled_for, timezone, status, last_error_message, updated_at").eq("owner_id", owner.user.id).order("scheduled_for", { ascending: view === "upcoming" });
  query = view === "upcoming" ? query.in("status", ["SCHEDULED", "PROCESSING", "FAILED"]) : query.in("status", ["SENT", "CANCELLED"]);
  const { data: messages, error } = await query;
  if (error) throw new Error("SCHEDULED_MAIL_UNAVAILABLE");
  const accountIds = [...new Set((messages ?? []).map((message) => message.mail_account_id))];
  const projectIds = [...new Set((messages ?? []).map((message) => message.project_id).filter(Boolean))] as string[];
  const messageIds = (messages ?? []).map((message) => message.id);
  const [{ data: accounts }, { data: projects }, { data: attachments }] = await Promise.all([
    accountIds.length ? owner.database.from("mail_accounts").select("id, email_address").eq("owner_id", owner.user.id).in("id", accountIds) : Promise.resolve({ data: [] }),
    projectIds.length ? owner.database.from("projects").select("id, name").eq("owner_id", owner.user.id).in("id", projectIds) : Promise.resolve({ data: [] }),
    messageIds.length ? owner.database.from("scheduled_message_attachments").select("scheduled_message_id").eq("owner_id", owner.user.id).in("scheduled_message_id", messageIds) : Promise.resolve({ data: [] })
  ]);
  const accountNames = new Map((accounts ?? []).map((account) => [account.id, account.email_address]));
  const projectNames = new Map((projects ?? []).map((project) => [project.id, project.name]));
  const attachmentCounts = new Map<string, number>();
  for (const attachment of attachments ?? []) attachmentCounts.set(attachment.scheduled_message_id, (attachmentCounts.get(attachment.scheduled_message_id) ?? 0) + 1);

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="scheduled">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Automatic delivery</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.035em] text-[#F4F7FB] sm:text-5xl">Scheduled</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">Review the exact messages KYM Mail will deliver through your approved identities.</p></div><Link href="/app/compose" className="rounded-full kym-action px-5 py-3 text-sm font-semibold text-white">Compose email</Link></header>
      <nav aria-label="Scheduled views" className="mt-8 flex gap-2"><Link href="/app/scheduled" aria-current={view === "upcoming" ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "upcoming" ? "bg-[#0E1C33] text-white" : "border border-[#1C283C] text-[#93A0B5]"}`}>Upcoming</Link><Link href="/app/scheduled?view=history" aria-current={view === "history" ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-semibold ${view === "history" ? "bg-[#0E1C33] text-white" : "border border-[#1C283C] text-[#93A0B5]"}`}>History</Link></nav>
      {messages?.length ? <div className="mt-6 space-y-3">{messages.map((message) => { const status = message.status as ScheduledStatus; const attachmentCount = attachmentCounts.get(message.id) ?? 0; return <Link key={message.id} href={`/app/scheduled/${message.id}`} className="block min-w-0 rounded-3xl border border-[#1C283C] bg-[#101828] p-5 shadow-[0_12px_36px_rgba(0,0,0,.05)] transition hover:border-[#1D4E89] sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[.08em] ${status === "FAILED" ? "bg-[#2A1218] text-[#67E8F9]" : "bg-[#122033] text-[#67E8F9]"}`}>{scheduledStatusLabels[status]}</span>{attachmentCount > 0 && <span className="inline-flex items-center gap-1 text-xs text-[#93A0B5]"><Paperclip className="size-3.5" /> {attachmentCount}</span>}</div><h2 className="mt-3 truncate text-lg font-semibold text-[#F4F7FB]">{message.subject}</h2><p className="mt-1 truncate text-sm text-[#93A0B5]">To: {message.to_addresses.join(", ")}</p><p className="mt-1 truncate text-xs text-[#93A0B5]">From: {accountNames.get(message.mail_account_id) ?? "Unavailable identity"}{message.project_id ? ` · Project: ${projectNames.get(message.project_id) ?? "Archived Project"}` : ""}</p>{message.last_error_message && status === "FAILED" && <p className="mt-3 text-sm text-[#67E8F9]">{message.last_error_message}</p>}</div><time className="max-w-xs text-sm font-semibold text-[#F4F7FB]" dateTime={message.scheduled_for}>{formatScheduledTimestamp(message.scheduled_for, message.timezone)}</time></div></Link>; })}</div> : <div className="mt-8 rounded-3xl border border-[#1C283C] bg-[#101828] p-8 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#122033] text-[#22D3EE]"><CalendarClock className="size-5" /></span><h2 className="mt-4 text-lg font-semibold text-[#F4F7FB]">{view === "upcoming" ? "Nothing scheduled" : "No scheduling history"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#93A0B5]">{view === "upcoming" ? "Schedule an email from Compose when it should be delivered later." : "Sent and cancelled schedules will appear here truthfully."}</p></div>}
    </div>
  </AppShell>;
}
