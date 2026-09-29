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

  return <div className="mt-5 border-t border-[#1C283C] pt-4">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setMode((current) => current === "reply" ? null : "reply")} aria-expanded={mode === "reply"} className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE] px-4 py-2 text-xs font-semibold text-[#67E8F9] transition hover:bg-[#122033]"><Reply className="size-3.5" /> Reply</button>
      <button type="button" onClick={() => setMode((current) => current === "forward" ? null : "forward")} aria-expanded={mode === "forward"} className="inline-flex items-center gap-2 rounded-full border border-[#1C283C] px-4 py-2 text-xs font-semibold text-[#F4F7FB] transition hover:bg-[#122033]"><Forward className="size-3.5" /> Forward</button>
    </div>
    {mode && draft && <section className="mt-5" aria-label={`${mode === "reply" ? "Reply to" : "Forward"} message`}>
      <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-base font-semibold text-[#F4F7FB]">{mode === "reply" ? "Reply" : "Forward message"}</h2><button type="button" onClick={() => setMode(null)} aria-label={`Close ${mode} composer`} className="rounded-lg p-1.5 text-[#93A0B5] hover:bg-[#122033]"><X className="size-4" /></button></div>
      {mode === "forward" && message.unavailableAttachmentCount > 0 && <p className="mb-3 rounded-xl bg-[#122033] px-4 py-3 text-xs leading-5 text-[#67E8F9]">{message.unavailableAttachmentCount} original attachment{message.unavailableAttachmentCount === 1 ? " was" : "s were"} excluded because it could not be forwarded safely.</p>}
      <ComposeForm key={mode} identities={identities} projects={projects} initialProjectId={initialProjectId} draft={draft} successPath={mode === "reply" ? threadPath : undefined} onSent={() => setMode(null)} />
    </section>}
  </div>;
}
