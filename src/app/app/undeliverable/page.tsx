import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MailboxBrowser } from "@/components/mailbox-browser";
import { withMessageParties } from "@/lib/mail/mailbox-query";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Undeliverable" };

export default async function UndeliverablePage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const [{ data: accounts, error: accountsError }, { data: bouncedMessages, error: bouncedError }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address").eq("owner_id", owner.user.id),
    owner.database.from("mail_messages").select("thread_id, from_address, to_addresses").eq("owner_id", owner.user.id).eq("is_undeliverable", true).order("sent_at", { ascending: false }).limit(200)
  ]);
  if (accountsError || bouncedError) throw new Error("UNDELIVERABLE_UNAVAILABLE");
  const accountEmails = new Map((accounts ?? []).map((account) => [account.id, account.email_address]));
  const threadIds = [...new Set((bouncedMessages ?? []).map((message) => message.thread_id))];
  const [{ data: rows, error }, { data: sentMessages, error: sentError }] = await Promise.all([
    threadIds.length
      ? owner.database.from("mail_threads").select("id, mail_account_id, subject, snippet, last_message_at, is_unread, has_attachments").eq("owner_id", owner.user.id).in("id", threadIds).order("last_message_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    threadIds.length
      ? owner.database.from("mail_messages").select("thread_id, from_address, to_addresses").eq("owner_id", owner.user.id).eq("is_sent", true).in("thread_id", threadIds).order("sent_at", { ascending: false }).limit(200)
      : Promise.resolve({ data: [], error: null })
  ]);
  if (error || sentError) throw new Error("UNDELIVERABLE_UNAVAILABLE");
  const threads = withMessageParties(
    (rows ?? []).map((thread) => ({ ...thread, identityEmail: accountEmails.get(thread.mail_account_id) ?? "KYM Mail" })),
    (sentMessages?.length ? sentMessages : bouncedMessages) ?? []
  );

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="undeliverable">
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Delivery failures</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#F4F7FB] sm:text-4xl">Undeliverable</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">Bounce notices are kept here, out of Inbox and Sent. A bounce also stops any follow-up sequence on that conversation.</p>
      <MailboxBrowser threads={threads} mailbox="undeliverable" emptyTitle="No undeliverable mail" emptyMessage="When a message comes back as undeliverable, it will appear here." />
    </div>
  </AppShell>;
}
