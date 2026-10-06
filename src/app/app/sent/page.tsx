import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MailboxBrowser } from "@/components/mailbox-browser";
import { withMessageParties } from "@/lib/mail/mailbox-query";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { hasTwilioEnv } from "@/lib/env";

export const metadata = { title: "Sent" };

export default async function SentPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const [{ data: accounts, error: accountsError }, { data: sentMessages, error: sentError }, { data: bouncedMessages, error: bouncedError }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address").eq("owner_id", owner.user.id),
    owner.database.from("mail_messages").select("thread_id, from_address, to_addresses").eq("owner_id", owner.user.id).eq("is_sent", true).eq("is_undeliverable", false).order("sent_at", { ascending: false }).limit(200),
    owner.database.from("mail_messages").select("thread_id").eq("owner_id", owner.user.id).eq("is_undeliverable", true).limit(1000)
  ]);
  if (accountsError || sentError || bouncedError) throw new Error("SENT_UNAVAILABLE");
  const accountEmails = new Map((accounts ?? []).map((account) => [account.id, account.email_address]));
  const bouncedThreadIds = new Set((bouncedMessages ?? []).map((message) => message.thread_id));
  const threadIds = [...new Set((sentMessages ?? []).map((message) => message.thread_id))].filter((threadId) => !bouncedThreadIds.has(threadId));
  const { data: rows, error } = threadIds.length
    ? await owner.database.from("mail_threads").select("id, mail_account_id, subject, snippet, last_message_at, is_unread, has_attachments").eq("owner_id", owner.user.id).in("id", threadIds).order("last_message_at", { ascending: false })
    : { data: [], error: null };
  if (error) throw new Error("SENT_UNAVAILABLE");
  const threads = withMessageParties(
    (rows ?? []).map((thread) => ({ ...thread, identityEmail: accountEmails.get(thread.mail_account_id) ?? "KYM Mail" })),
    sentMessages ?? []
  );
  const sent = (await searchParams).sent === "true";
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="sent">
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Unified mailbox</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#F4F7FB] sm:text-4xl">Sent</h1>
      {sent && <p role="status" className="my-6 rounded-2xl border border-[#1D4E89] bg-[#122033] px-5 py-4 text-sm font-semibold text-[#67E8F9]">Your message was sent successfully.</p>}
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#93A0B5]">Select sent conversations to start a three-touch follow-up. A live reply texts you and stops the sequence.</p>
      <MailboxBrowser threads={threads} mailbox="sent" smsConfigured={hasTwilioEnv()} emptyTitle="No sent messages" emptyMessage="Messages sent through KYM Mail will appear here after Google confirms delivery." />
    </div>
  </AppShell>;
}

