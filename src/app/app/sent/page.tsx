import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { MailThreadList, type ThreadListItem } from "@/components/mail-thread-list";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Sent" };

export default async function SentPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const [{ data: accounts, error: accountsError }, { data: sentMessages, error: sentError }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address").eq("owner_id", owner.user.id),
    owner.database.from("mail_messages").select("thread_id").eq("owner_id", owner.user.id).eq("is_sent", true).order("sent_at", { ascending: false }).limit(200)
  ]);
  if (accountsError || sentError) throw new Error("SENT_UNAVAILABLE");
  const accountEmails = new Map((accounts ?? []).map((account) => [account.id, account.email_address]));
  const threadIds = [...new Set((sentMessages ?? []).map((message) => message.thread_id))];
  const { data: rows, error } = threadIds.length
    ? await owner.database.from("mail_threads").select("id, mail_account_id, subject, snippet, last_message_at, is_unread, has_attachments").eq("owner_id", owner.user.id).in("id", threadIds).order("last_message_at", { ascending: false })
    : { data: [], error: null };
  if (error) throw new Error("SENT_UNAVAILABLE");
  const threads: ThreadListItem[] = (rows ?? []).map((thread) => ({ ...thread, identityEmail: accountEmails.get(thread.mail_account_id) ?? "KYM Mail" }));
  const sent = (await searchParams).sent === "true";
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="sent">
    <div className="mx-auto max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Unified mailbox</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">Sent</h1>
      {sent && <p role="status" className="my-6 rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-5 py-4 text-sm font-semibold text-[#A73D52]">Your message was sent successfully.</p>}
      <div className="mt-7"><MailThreadList threads={threads} emptyTitle="No sent messages" emptyMessage="Messages sent through KYM Mail will appear here after Google confirms delivery." /></div>
    </div>
  </AppShell>;
}

