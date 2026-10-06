import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { GmailConnectionPanel } from "@/components/gmail-connection-panel";
import { MailboxBrowser } from "@/components/mailbox-browser";
import { withMessageParties } from "@/lib/mail/mailbox-query";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { user, database } = owner;
  const [
    { data: mailAccounts, error: accountsError },
    { data: connection, error: connectionError },
    { data: inboxMessages, error: inboxError },
    { data: bouncedMessages, error: bouncedError }
  ] = await Promise.all([
    database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", user.id).order("is_default", { ascending: false }),
    database.from("mail_connections").select("id, provider_account_id, connection_state, initial_sync_completed_at, last_synced_at, sync_error").eq("owner_id", user.id).eq("provider", "google").maybeSingle(),
    database.from("mail_messages").select("thread_id, from_address, to_addresses").eq("owner_id", user.id).eq("is_inbox", true).eq("is_undeliverable", false).order("sent_at", { ascending: false }).limit(200),
    database.from("mail_messages").select("thread_id").eq("owner_id", user.id).eq("is_undeliverable", true).limit(1000)
  ]);
  if (accountsError || connectionError || inboxError || bouncedError) throw new Error("INBOX_UNAVAILABLE");

  const accounts = mailAccounts ?? [];
  const accountEmails = new Map(accounts.map((account) => [account.id, account.email_address]));
  const bouncedThreadIds = new Set((bouncedMessages ?? []).map((message) => message.thread_id));
  const threadIds = [...new Set((inboxMessages ?? []).map((message) => message.thread_id))].filter((threadId) => !bouncedThreadIds.has(threadId));
  const { data: threadRows, error: threadsError } = threadIds.length
    ? await database.from("mail_threads").select("id, mail_account_id, subject, snippet, last_message_at, is_unread, has_attachments").eq("owner_id", user.id).in("id", threadIds).order("last_message_at", { ascending: false })
    : { data: [], error: null };
  if (threadsError) throw new Error("INBOX_UNAVAILABLE");
  const threads = withMessageParties(
    (threadRows ?? []).map((thread) => ({ ...thread, identityEmail: accountEmails.get(thread.mail_account_id) ?? "KYM Mail" })),
    inboxMessages ?? []
  );
  const availableIdentityCount = accounts.filter((account) => account.send_as_state === "available").length;

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="inbox">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Unified mailbox</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#F4F7FB] sm:text-4xl">Inbox</h1></div>
        <Link href="/app/compose" className="rounded-full kym-action px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(37,99,235,.22)] transition ">Compose</Link>
      </div>

      <GmailConnectionPanel connection={connection ?? null} availableIdentityCount={availableIdentityCount} />
      {bouncedThreadIds.size > 0 && <Link href="/app/undeliverable" className="mt-6 block rounded-2xl border border-[#1D4E89] bg-[#122033] px-5 py-4 text-sm font-semibold text-[#67E8F9]">{bouncedThreadIds.size} undeliverable {bouncedThreadIds.size === 1 ? "conversation was" : "conversations were"} moved to the Undeliverable box.</Link>}
      <MailboxBrowser threads={threads} mailbox="inbox" emptyTitle="Your inbox is clear" emptyMessage="No messages for your verified KYM Mail identities have synchronized yet. New mail will appear here after Gmail receives it." />
    </div>
  </AppShell>;
}
