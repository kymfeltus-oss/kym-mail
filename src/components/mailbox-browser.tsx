"use client";

import { useMemo, useState } from "react";
import { FollowUpPanel } from "@/components/follow-up-panel";
import { MailThreadList, type ThreadListItem } from "@/components/mail-thread-list";
import { isMailSort, searchThreads, sortThreads, type Mailbox, type MailSort } from "@/lib/mail/mailbox-query";

function sortLabels(mailbox: Mailbox): Record<MailSort, string> {
  const person = mailbox === "inbox" ? "Sender" : "Recipient";
  return {
    newest: "Newest",
    oldest: "Oldest",
    sender: `${person} A–Z`,
    "sender-desc": `${person} Z–A`,
    subject: "Subject A–Z",
    unread: "Unread first"
  };
}

export function MailboxBrowser({ threads, mailbox, emptyTitle, emptyMessage, smsConfigured = false }: {
  threads: ThreadListItem[];
  mailbox: Mailbox;
  emptyTitle: string;
  emptyMessage: string;
  smsConfigured?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<MailSort>("newest");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visible = useMemo(() => sortThreads(searchThreads(threads, query), sort, mailbox), [threads, query, sort, mailbox]);
  const selected = new Set(selectedIds);
  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  if (!threads.length) return <MailThreadList threads={threads} mailbox={mailbox} emptyTitle={emptyTitle} emptyMessage={emptyMessage} />;
  const searching = query.trim().length > 0;

  return <div className="mt-7">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="grid min-w-0 flex-1 gap-2 text-sm font-semibold text-[#F4F7FB]">Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search mail" className="w-full rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal text-[#F4F7FB] outline-none placeholder:text-[#93A0B5] focus:border-[#22D3EE]" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-[#F4F7FB] sm:w-48">Sort
        <select value={sort} onChange={(event) => { if (isMailSort(event.target.value)) setSort(event.target.value); }} className="w-full rounded-xl border border-[#1C283C] bg-[#101828] px-4 py-3 font-normal text-[#F4F7FB] outline-none focus:border-[#22D3EE]">
          {Object.entries(sortLabels(mailbox)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <p className="mb-4 text-xs leading-5 text-[#93A0B5]">Search subject, sender, recipient, or preview. Use from:, to:, subject:, is:unread, or has:attachment.</p>
    {searching && <p className="mb-3 text-xs font-semibold uppercase tracking-[.12em] text-[#67E8F9]">{visible.length} of {threads.length}</p>}
    {mailbox === "sent" && selectedIds.length > 0 && <FollowUpPanel threadIds={selectedIds} smsConfigured={smsConfigured} onClear={() => setSelectedIds([])} />}
    {visible.length === 0
      ? <div className="glass rounded-3xl p-8 text-center sm:p-12"><h2 className="text-xl font-semibold text-[#F4F7FB]">No matching messages</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#93A0B5]">Nothing in this mailbox matches that search.</p></div>
      : <MailThreadList threads={visible} mailbox={mailbox} emptyTitle={emptyTitle} emptyMessage={emptyMessage} selectedIds={mailbox === "sent" ? selected : undefined} onToggle={mailbox === "sent" ? toggle : undefined} />}
  </div>;
}
