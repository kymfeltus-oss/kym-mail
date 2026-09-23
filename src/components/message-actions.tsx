"use client";

import { useState } from "react";
import { Forward, Reply, X } from "lucide-react";
import { ComposeForm, type ComposeDraft, type ComposeIdentity, type ComposeProject } from "@/components/compose-form";
import { forwardBody, forwardSubject, replyRecipient, replySubject } from "@/lib/mail/reply-forward";

type MessageActionSource = {
  id: string;
  identityEmail: string;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  textBody: string | null;
  sentAtLabel: string;
  internetMessageId: string | null;
  providerThreadId: string;
  attachments: Array<{ id: string; filename: string; sizeBytes: number }>;
  unavailableAttachmentCount: number;
};

export function MessageActions({ message, identities, projects, initialProjectId, threadPath }: {
  message: MessageActionSource;
  identities: ComposeIdentity[];
  projects: ComposeProject[];
  initialProjectId: string;
  threadPath: string;
}) {
  const [mode, setMode] = useState<"reply" | "forward" | null>(null);
  const identityEmails = identities.map((identity) => identity.email_address);
  const draft: ComposeDraft | null = mode === "reply" ? {
    mode: "reply",
    from: message.identityEmail,
    to: replyRecipient(message, identityEmails),
    subject: replySubject(message.subject),
    providerThreadId: message.providerThreadId,
    replyToMessageId: message.internetMessageId ?? ""
  } : mode === "forward" ? {
    mode: "forward",
    from: message.identityEmail,
    to: "",
    subject: forwardSubject(message.subject),
    body: forwardBody(message, message.sentAtLabel),
    forwardedAttachments: message.attachments
  } : null;

  return <div className="mt-5 border-t border-[#E8E2E3] pt-4">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setMode((current) => current === "reply" ? null : "reply")} aria-expanded={mode === "reply"} className="inline-flex items-center gap-2 rounded-full border border-[#D95B72] px-4 py-2 text-xs font-semibold text-[#A73D52] transition hover:bg-[#FFF3F4]"><Reply className="size-3.5" /> Reply</button>
      <button type="button" onClick={() => setMode((current) => current === "forward" ? null : "forward")} aria-expanded={mode === "forward"} className="inline-flex items-center gap-2 rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#183A5A] transition hover:bg-[#FFF3F4]"><Forward className="size-3.5" /> Forward</button>
    </div>
    {mode && draft && <section className="mt-5" aria-label={`${mode === "reply" ? "Reply to" : "Forward"} message`}>
      <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-base font-semibold text-[#183A5A]">{mode === "reply" ? "Reply" : "Forward message"}</h2><button type="button" onClick={() => setMode(null)} aria-label={`Close ${mode} composer`} className="rounded-lg p-1.5 text-[#64748B] hover:bg-[#FFF3F4]"><X className="size-4" /></button></div>
      {mode === "forward" && message.unavailableAttachmentCount > 0 && <p className="mb-3 rounded-xl bg-[#FFF3F4] px-4 py-3 text-xs leading-5 text-[#A73D52]">{message.unavailableAttachmentCount} original attachment{message.unavailableAttachmentCount === 1 ? " was" : "s were"} excluded because it could not be forwarded safely.</p>}
      <ComposeForm key={mode} identities={identities} projects={projects} initialProjectId={initialProjectId} draft={draft} successPath={mode === "reply" ? threadPath : undefined} onSent={() => setMode(null)} />
    </section>}
  </div>;
}
