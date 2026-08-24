import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MailSyncControl } from "@/components/mail-sync-control";
import { MailThreadList, type ThreadListItem } from "@/components/mail-thread-list";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Inbox" };

export default async function InboxPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { user, database } = owner;
  const [
    { data: mailAccounts, error: accountsError },
    { data: connection, error: connectionError },
    { data: inboxMessages, error: inboxError }
  ] = await Promise.all([
    database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", user.id).order("is_default", { ascending: false }),
    database.from("mail_connections").select("id, provider_account_id, connection_state, initial_sync_completed_at, last_synced_at, sync_error").eq("owner_id", user.id).eq("provider", "google").maybeSingle(),
    database.from("mail_messages").select("thread_id").eq("owner_id", user.id).eq("is_inbox", true).order("sent_at", { ascending: false }).limit(200)
  ]);
  if (accountsError || connectionError || inboxError) throw new Error("INBOX_UNAVAILABLE");

  const accounts = mailAccounts ?? [];
  const accountEmails = new Map(accounts.map((account) => [account.id, account.email_address]));
  const threadIds = [...new Set((inboxMessages ?? []).map((message) => message.thread_id))];
  const { data: threadRows, error: threadsError } = threadIds.length
    ? await database.from("mail_threads").select("id, mail_account_id, subject, snippet, last_message_at, is_unread, has_attachments").eq("owner_id", user.id).in("id", threadIds).order("last_message_at", { ascending: false })
    : { data: [], error: null };
  if (threadsError) throw new Error("INBOX_UNAVAILABLE");
  const threads: ThreadListItem[] = (threadRows ?? []).map((thread) => ({ ...thread, identityEmail: accountEmails.get(thread.mail_account_id) ?? "KYM Mail" }));
  const connected = connection?.connection_state === "connected";
  const reauthorizationRequired = connection?.connection_state === "reauth_required";
  const connectionFailed = connection?.connection_state === "error";
  const availableIdentityCount = accounts.filter((account) => account.send_as_state === "available").length;

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="inbox">
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Unified mailbox</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">Inbox</h1></div>
        <Link href="/app/compose" className="rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64]">Compose</Link>
      </div>

      {!connected && <section className="glass my-7 rounded-3xl p-6 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-5"><div><h2 className="text-xl font-semibold text-[#183A5A]">{reauthorizationRequired ? "Reconnect Google Mail" : connectionFailed ? "Google Mail needs attention" : "Connect Google Mail"}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#64748B]">{reauthorizationRequired ? "Google authorization is no longer usable. Reconnect securely to resume synchronization and sending." : connectionFailed ? "The provider connection could not be used. Reconnect Google Mail to recover safely." : "Authorize the private Gmail provider to synchronize and send through your verified KYM Mail identities."}</p>{connection?.sync_error && <p className="mt-2 text-sm text-[#A73D52]">{connection.sync_error}</p>}</div><Link href="/api/oauth/google/start" className="rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white">{reauthorizationRequired || connectionFailed ? "Reconnect Google Mail" : "Connect Google Mail"}</Link></div></section>}
      {connected && <details className="my-7 rounded-2xl border border-[#E8E2E3] bg-[#FFFCFB] px-5 py-4"><summary className="cursor-pointer text-sm font-semibold text-[#183A5A]">Google Mail connected · {availableIdentityCount} verified sender{availableIdentityCount === 1 ? "" : "s"}</summary><p className="mt-3 text-xs text-[#64748B]">Provider account: {connection.provider_account_id}</p>{connection.sync_error && <p className="mt-2 text-sm text-[#A73D52]">{connection.sync_error}</p>}<MailSyncControl connected initialSyncComplete={Boolean(connection.initial_sync_completed_at)} lastSyncedAt={connection.last_synced_at ?? null} /></details>}
      <MailThreadList threads={threads} emptyTitle="Your inbox is clear" emptyMessage="No messages for your verified KYM Mail identities have synchronized yet. New mail will appear here after Gmail receives it." />
    </div>
  </AppShell>;
}
