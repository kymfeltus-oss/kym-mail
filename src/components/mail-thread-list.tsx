import Link from "next/link";
import { Paperclip } from "lucide-react";
import { formatMailListTimestamp } from "@/lib/mail/date-format";

export type ThreadListItem = {
  id: string;
  subject: string;
  snippet: string | null;
  last_message_at: string;
  is_unread: boolean;
  has_attachments: boolean;
  identityEmail: string;
};

export function MailThreadList({ threads, emptyTitle, emptyMessage }: { threads: ThreadListItem[]; emptyTitle: string; emptyMessage: string }) {
  if (!threads.length) return <div className="glass rounded-3xl p-8 text-center sm:p-12"><h2 className="text-xl font-semibold text-[#183A5A]">{emptyTitle}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#64748B]">{emptyMessage}</p></div>;
  return <div className="overflow-hidden rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] shadow-[0_20px_60px_rgba(24,58,90,.08)]">
    {threads.map((thread) => <Link key={thread.id} href={`/app/thread/${thread.id}`} className={`grid gap-2 border-b border-[#E8E2E3] px-5 py-4 transition last:border-b-0 hover:bg-[#FFF3F4] sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6 ${thread.is_unread ? "bg-[#FFF7F8]" : ""}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2"><span className={`truncate text-sm text-[#183A5A] ${thread.is_unread ? "font-bold" : "font-semibold"}`}>{thread.subject}</span>{thread.has_attachments && <Paperclip aria-label="Has attachments" className="size-3.5 shrink-0 text-[#D95B72]" />}</div>
        <p className="mt-1 truncate text-sm text-[#64748B]">{thread.snippet || "No message preview available."}</p>
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#A73D52]">{thread.identityEmail}</p>
      </div>
      <time className="text-xs text-[#64748B]" dateTime={thread.last_message_at}>{formatMailListTimestamp(thread.last_message_at)}</time>
    </Link>)}
  </div>;
}
