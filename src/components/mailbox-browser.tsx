"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
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
  const parableInbox = mailbox === "inbox";
  const selected = new Set(selectedIds);
  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  if (!threads.length) return <MailThreadList threads={threads} mailbox={mailbox} emptyTitle={emptyTitle} emptyMessage={emptyMessage} />;
  const searching = query.trim().length > 0;

  return <div className={parableInbox ? "mt-9" : "mt-7"}>
    {parableInbox && <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.27em] text-[#9A7CFF]">Incoming transmissions</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-white sm:text-3xl">Message stream</h2>
      </div>
      <p className="rounded-full border border-cyan-200/15 bg-cyan-200/[.045] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.16em] text-cyan-100">{threads.length} {threads.length === 1 ? "thread" : "threads"}</p>
    </div>}
    <div className={`mb-4 flex flex-col gap-3 sm:flex-row sm:items-center ${parableInbox ? "rounded-2xl border border-cyan-200/15 bg-[#080e1a]/90 p-4 shadow-[0_14px_50px_rgba(0,0,0,.18)]" : ""}`}>
      <label className={`grid min-w-0 flex-1 gap-2 text-sm font-semibold ${parableInbox ? "text-cyan-50" : "text-[#F4F7FB]"}`}>Search
        <span className="relative block">
          <Search aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 ${parableInbox ? "text-cyan-200/65" : "text-[#93A0B5]"}`} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Search mail" className={`w-full rounded-xl border py-3 pl-11 pr-4 font-normal outline-none placeholder:text-[#77859a] focus:border-[#22D3EE] ${parableInbox ? "border-white/10 bg-[#040914] text-white" : "border-[#1C283C] bg-[#101828] px-4 text-[#F4F7FB]"}`} />
        </span>
      </label>
      <label className={`grid gap-2 text-sm font-semibold sm:w-48 ${parableInbox ? "text-cyan-50" : "text-[#F4F7FB]"}`}>Sort
        <span className="relative block">
          <SlidersHorizontal aria-hidden="true" className={`pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 ${parableInbox ? "text-cyan-200/65" : "text-[#93A0B5]"}`} />
          <select value={sort} onChange={(event) => { if (isMailSort(event.target.value)) setSort(event.target.value); }} className={`w-full appearance-none rounded-xl border py-3 pl-11 pr-4 font-normal outline-none focus:border-[#22D3EE] ${parableInbox ? "border-white/10 bg-[#040914] text-white" : "border-[#1C283C] bg-[#101828] text-[#F4F7FB]"}`}>
          {Object.entries(sortLabels(mailbox)).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </span>
      </label>
    </div>
    <p className={`mb-4 text-xs leading-5 ${parableInbox ? "text-slate-400" : "text-[#93A0B5]"}`}>Search subject, sender, recipient, or preview. Use from:, to:, subject:, is:unread, or has:attachment.</p>
    {searching && <p className={`mb-3 text-xs font-semibold uppercase tracking-[.12em] ${parableInbox ? "text-cyan-200" : "text-[#67E8F9]"}`}>{visible.length} of {threads.length}</p>}
    {mailbox === "sent" && selectedIds.length > 0 && <FollowUpPanel threadIds={selectedIds} smsConfigured={smsConfigured} onClear={() => setSelectedIds([])} />}
    {visible.length === 0
      ? <div className="glass rounded-3xl p-8 text-center sm:p-12"><h2 className="text-xl font-semibold text-[#F4F7FB]">No matching messages</h2><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#93A0B5]">Nothing in this mailbox matches that search.</p></div>
      : <MailThreadList threads={visible} mailbox={mailbox} emptyTitle={emptyTitle} emptyMessage={emptyMessage} selectedIds={mailbox === "sent" ? selected : undefined} onToggle={mailbox === "sent" ? toggle : undefined} />}
  </div>;
}
