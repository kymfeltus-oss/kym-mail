"use client";

import Link from "next/link";
import { Paperclip } from "lucide-react";
import { formatMailListTimestamp } from "@/lib/mail/date-format";
import { threadCorrespondent, type Mailbox, type ThreadListItem } from "@/lib/mail/mailbox-query";

export type { ThreadListItem };

export function MailThreadList({ threads, mailbox, emptyTitle, emptyMessage }: { threads: ThreadListItem[]; mailbox: Mailbox; emptyTitle: string; emptyMessage: string }) {
  if (!threads.length) return <div className="glass rounded-3xl p-8 text-center sm:p-12"><h2 className="text-xl font-semibold text-[#F4F7FB]">{emptyTitle}</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#93A0B5]">{emptyMessage}</p></div>;
  return <div className="overflow-hidden rounded-3xl border border-[#1C283C] bg-[#101828] shadow-[0_20px_60px_rgba(0,0,0,.08)]">
    {threads.map((thread) => {
      const correspondent = threadCorrespondent(thread, mailbox);
      return <Link key={thread.id} href={`/app/thread/${thread.id}`} className={`grid gap-2 border-b border-[#1C283C] px-5 py-4 transition last:border-b-0 hover:bg-[#122033] sm:grid-cols-[minmax(0,1fr)_auto] sm:px-6 ${thread.is_unread ? "bg-[#122033]" : ""}`}>
        <div className="min-w-0">
          <p className={`truncate text-sm text-[#F4F7FB] ${thread.is_unread ? "font-bold" : "font-semibold"}`}>{mailbox === "sent" ? `To: ${correspondent}` : correspondent}</p>
          <div className="mt-1 flex items-center gap-2"><span className="truncate text-sm text-[#F4F7FB]">{thread.subject}</span>{thread.has_attachments && <Paperclip aria-label="Has attachments" className="size-3.5 shrink-0 text-[#22D3EE]" />}</div>
          <p className="mt-1 truncate text-sm text-[#93A0B5]">{thread.snippet || "No message preview available."}</p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#67E8F9]">{thread.identityEmail}</p>
        </div>
        <time className="text-xs text-[#93A0B5]" dateTime={thread.last_message_at}>{formatMailListTimestamp(thread.last_message_at)}</time>
      </Link>;
    })}
  </div>;
}
