import { notFound, redirect } from "next/navigation";
import { Paperclip } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ComposeForm } from "@/components/compose-form";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { formatMailTimestamp } from "@/lib/mail/date-format";

export const metadata = { title: "Thread" };

export default async function ThreadPage({ params }: { params: Promise<{ threadId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { threadId } = await params;
  const [{ data: thread, error: threadError }, { data: messages, error: messagesError }, { data: identities, error: identitiesError }] = await Promise.all([
    owner.database.from("mail_threads").select("id, provider_thread_id, subject").eq("id", threadId).eq("owner_id", owner.user.id).maybeSingle(),
    owner.database.from("mail_messages").select("id, mail_account_id, internet_message_id, from_address, to_addresses, cc_addresses, subject, text_body, sanitized_html_body, sent_at, is_sent").eq("thread_id", threadId).eq("owner_id", owner.user.id).order("sent_at", { ascending: true }),
    owner.database.from("mail_accounts").select("id, email_address, label, is_default").eq("owner_id", owner.user.id).eq("is_active", true).eq("send_as_state", "available").order("is_default", { ascending: false })
  ]);
  if (threadError || messagesError || identitiesError) throw new Error("THREAD_UNAVAILABLE");
  if (!thread) notFound();
  const messageIds = (messages ?? []).map((message) => message.id);
  const { data: attachments, error: attachmentError } = messageIds.length
    ? await owner.database.from("mail_attachments").select("id, message_id, filename, mime_type, size_bytes").eq("owner_id", owner.user.id).in("message_id", messageIds)
    : { data: [], error: null };
  if (attachmentError) throw new Error("THREAD_UNAVAILABLE");
  const attachmentsByMessage = new Map<string, typeof attachments>();
  for (const attachment of attachments ?? []) attachmentsByMessage.set(attachment.message_id, [...(attachmentsByMessage.get(attachment.message_id) ?? []), attachment]);
  const identityEmails = new Map((identities ?? []).map((identity) => [identity.id, identity.email_address]));
  const lastMessage = messages?.at(-1);
  const replyTo = lastMessage ? (lastMessage.is_sent ? lastMessage.to_addresses[0] : lastMessage.from_address) : "";
  const replySubject = thread.subject.toLowerCase().startsWith("re:") ? thread.subject : `Re: ${thread.subject}`;

  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active={lastMessage?.is_sent ? "sent" : "inbox"}>
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Conversation</p><h1 className="mt-2 text-2xl font-semibold tracking-[-.025em] text-[#183A5A] sm:text-3xl">{thread.subject}</h1>
      <div className="mt-7 space-y-4">{(messages ?? []).map((message) => <article key={message.id} className="rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_40px_rgba(24,58,90,.06)] sm:p-7">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E2E3] pb-4"><div><p className="text-sm font-semibold text-[#183A5A]">From: {message.from_address}</p><p className="mt-1 text-xs text-[#64748B]">To: {message.to_addresses.join(", ") || "Undisclosed recipient"}</p>{message.cc_addresses.length > 0 && <p className="mt-1 text-xs text-[#64748B]">CC: {message.cc_addresses.join(", ")}</p>}<p className="mt-2 text-[11px] font-semibold uppercase tracking-[.1em] text-[#A73D52]">{identityEmails.get(message.mail_account_id) ?? "KYM Mail"}</p></div><time className="text-xs text-[#64748B]" dateTime={message.sent_at}>{formatMailTimestamp(message.sent_at)}</time></header>
        {message.sanitized_html_body ? <div className="email-content mt-5 text-sm leading-7 text-[#243B53]" dangerouslySetInnerHTML={{ __html: message.sanitized_html_body }} /> : <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#243B53]">{message.text_body || "This message has no displayable body."}</p>}
        {(attachmentsByMessage.get(message.id) ?? []).length > 0 && <ul className="mt-5 space-y-2 border-t border-[#E8E2E3] pt-4">{(attachmentsByMessage.get(message.id) ?? []).map((attachment) => <li key={attachment.id}><a href={`/api/mail/attachments/${attachment.id}`} className="flex items-center gap-2 text-xs font-semibold text-[#A73D52] hover:underline"><Paperclip className="size-3.5" /> {attachment.filename} · {(Number(attachment.size_bytes) / 1024).toFixed(1)} KB</a></li>)}</ul>}
      </article>)}</div>
      {lastMessage && identities?.length && <section className="mt-8"><h2 className="mb-4 text-lg font-semibold text-[#183A5A]">Reply</h2><ComposeForm identities={identities} reply={{ to: replyTo, subject: replySubject, providerThreadId: thread.provider_thread_id, replyToMessageId: lastMessage.internet_message_id ?? "" }} /></section>}
    </div>
  </AppShell>;
}
