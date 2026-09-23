"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Paperclip, Send, X } from "lucide-react";
import { buildProfessionalEmailHtml, defaultEmailLookForSender, emailLooks, isEmailLook, type EmailLook } from "@/lib/mail/professional-html";

export type ComposeIdentity = { id: string; email_address: string; label: string; is_default: boolean };
export type ComposeProject = { id: string; name: string; default_mail_account_id: string | null };
export type ComposeDraft = {
  mode: "reply" | "forward";
  from?: string;
  to: string;
  subject: string;
  body?: string;
  providerThreadId?: string;
  replyToMessageId?: string;
  forwardedAttachments?: Array<{ id: string; filename: string; sizeBytes: number }>;
};

function localInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function ComposeForm({ identities, projects = [], initialProjectId = "", draft, successPath, onSent }: {
  identities: ComposeIdentity[];
  projects?: ComposeProject[];
  initialProjectId?: string;
  draft?: ComposeDraft;
  successPath?: string;
  onSent?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const globalDefault = identities.find((identity) => identity.is_default) ?? identities[0];
  const initialProject = projects.find((project) => project.id === initialProjectId);
  const initialProjectIdentity = identities.find((identity) => identity.id === initialProject?.default_mail_account_id);
  const draftIdentity = identities.find((identity) => identity.email_address === draft?.from);
  const [projectId, setProjectId] = useState(initialProject?.id ?? "");
  const [from, setFrom] = useState(draftIdentity?.email_address ?? (initialProject ? initialProjectIdentity?.email_address ?? "" : globalDefault?.email_address ?? ""));
  const [advanced, setAdvanced] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [forwardedAttachments, setForwardedAttachments] = useState(draft?.forwardedAttachments ?? []);
  const [status, setStatus] = useState<"idle" | "sending" | "scheduling" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledLocal, setScheduledLocal] = useState(() => localInputValue(new Date(Date.now() + 5 * 60_000)));
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago");
  const [body, setBody] = useState(draft?.body ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [look, setLook] = useState<EmailLook>(() => defaultEmailLookForSender(from, draftIdentity?.label ?? initialProjectIdentity?.label ?? globalDefault?.label ?? ""));
  const selectedIdentity = identities.find((identity) => identity.email_address === from);
  const selectedProject = projects.find((project) => project.id === projectId);
  const defaultIdentityUnavailable = Boolean(selectedProject && !identities.some((identity) => identity.id === selectedProject.default_mail_account_id));

  function applyFrom(nextFrom: string) {
    const identity = identities.find((item) => item.email_address === nextFrom);
    setFrom(nextFrom);
    setLook(defaultEmailLookForSender(nextFrom, identity?.label ?? ""));
  }

  function selectProject(nextProjectId: string) {
    setProjectId(nextProjectId);
    const project = projects.find((item) => item.id === nextProjectId);
    if (!project) { applyFrom(globalDefault?.email_address ?? ""); return; }
    const identity = identities.find((item) => item.id === project.default_mail_account_id);
    applyFrom(identity?.email_address ?? "");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setError(null);
    const data = new FormData(event.currentTarget);
    data.delete("attachments"); files.forEach((file) => data.append("attachments", file));
    try {
      const response = await fetch("/api/mail/send", { method: "POST", body: data });
      const payload = await response.json() as { error?: string; sent?: boolean };
      if (!response.ok && !payload.sent) throw new Error(payload.error || "The message could not be sent.");
      formRef.current?.reset(); setFiles([]); setForwardedAttachments([]); setBody(""); setSubject(""); onSent?.();
      if (successPath) router.push(successPath); else router.push("/app/sent?sent=true");
      router.refresh();
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : "The message could not be sent.");
    }
  }

  async function schedule() {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    const instant = new Date(scheduledLocal);
    if (!scheduledLocal || !Number.isFinite(instant.getTime()) || instant.getTime() <= Date.now()) {
      setStatus("error"); setError("Choose a valid future delivery date and time."); return;
    }
    setStatus("scheduling"); setError(null);
    const data = new FormData(form);
    data.delete("attachments"); files.forEach((file) => data.append("attachments", file));
    data.set("scheduledFor", instant.toISOString()); data.set("timezone", timezone);
    try {
      const response = await fetch("/api/mail/schedule", { method: "POST", body: data });
      const payload = await response.json() as { error?: string; id?: string };
      if (!response.ok || !payload.id) throw new Error(payload.error || "The email could not be scheduled.");
      router.push(`/app/scheduled/${payload.id}?scheduled=true`); router.refresh();
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : "The email could not be scheduled.");
    }
  }

  const schedulePreview = scheduledLocal && Number.isFinite(new Date(scheduledLocal).getTime())
    ? new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(scheduledLocal))
    : "Choose a future time";

  return <form ref={formRef} onSubmit={submit} className="glass min-w-0 rounded-3xl p-5 sm:p-8">
    {draft?.providerThreadId && <input type="hidden" name="providerThreadId" value={draft.providerThreadId} />}
    {draft?.replyToMessageId && <input type="hidden" name="replyToMessageId" value={draft.replyToMessageId} />}
    {forwardedAttachments.map((attachment) => <input key={attachment.id} type="hidden" name="forwardAttachmentIds" value={attachment.id} />)}
    <div className="grid min-w-0 gap-5">
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Project
        <select name="projectId" value={projectId} onChange={(event) => selectProject(event.target.value)} className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal text-[#183A5A] outline-none focus:border-[#D95B72]">
          <option value="">None</option>
          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <span className="font-normal text-[#64748B]">Optional. Ordinary email does not require a Project.</span>
      </label>
      {defaultIdentityUnavailable && <div role="alert" className="rounded-2xl border border-[#F0C9D0] bg-[#FFF3F4] px-4 py-3"><p className="text-sm font-semibold text-[#A73D52]">Project default sender is unavailable</p><p className="mt-1 text-xs leading-5 text-[#64748B]">Choose a verified From identity explicitly. KYM Mail will not switch senders silently.</p></div>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">From
        <select name="from" value={from} onChange={(event) => applyFrom(event.target.value)} required className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal text-[#183A5A] outline-none focus:border-[#D95B72]">
          <option value="">Select a verified sender</option>
          {identities.map((identity) => <option key={identity.id} value={identity.email_address}>{identity.email_address} — {identity.label}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Stationery
        <select name="emailLook" value={look} onChange={(event) => { if (isEmailLook(event.target.value)) setLook(event.target.value); }} className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal text-[#183A5A] outline-none focus:border-[#D95B72]">
          {emailLooks.map((option) => <option key={option.id} value={option.id}>{option.name} — {option.description}</option>)}
        </select>
        <span className="font-normal text-[#64748B]">{from === "kym@kymmailapp.com" || /\bpersonal\b/i.test(selectedIdentity?.label ?? "") ? "Personal keeps the editorial look. Switch From to send on company stationery." : "This sender uses company stationery. Switch From to use the personal editorial look."}</span>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">To
        <input name="to" type="text" inputMode="email" required defaultValue={draft?.to} placeholder="recipient@example.com" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none placeholder:text-[#94A3B8] focus:border-[#D95B72]" />
      </label>
      {!advanced && <button type="button" onClick={() => setAdvanced(true)} className="w-fit text-xs font-semibold text-[#A73D52]">Add CC or BCC</button>}
      {advanced && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">CC<input name="cc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" /></label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">BCC<input name="bcc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" /></label>
      </div>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Subject
        <input name="subject" type="text" required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Message
        <textarea name="body" required rows={12} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your message…" className="w-full min-w-0 resize-y rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal leading-7 outline-none placeholder:text-[#94A3B8] focus:border-[#D95B72]" />
        <span className="font-normal text-[#64748B]">Blank lines become paragraphs. Lines that start with - become a list. The recipient receives this designed version.</span>
      </label>
      <section aria-label="Recipient preview" className={look === "personal" ? "border border-[#1A1A1A] bg-[#111111] p-3" : "border border-[#183A5A] bg-[#183A5A] p-3"}>
        <p className={`px-2 text-[10px] font-semibold uppercase tracking-[.28em] ${look === "personal" ? "text-[#C4A574]" : "text-[#E7B8C1]"}`}>Recipient preview</p>
        <iframe title="How the recipient will see this message" sandbox="" srcDoc={buildProfessionalEmailHtml({ from: from || "your verified sender", subject: subject || "Message preview", body: body || "Your message will appear here.", look })} className={`mt-3 h-[420px] w-full border-0 ${look === "personal" ? "bg-[#111111]" : "bg-[#E8EEF4]"}`} />
      </section>
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#183A5A] transition hover:bg-[#FFF3F4]"><Paperclip className="size-4 text-[#D95B72]" /> Attach files<input name="attachments" type="file" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
        {(forwardedAttachments.length > 0 || files.length > 0) && <ul className="mt-3 space-y-2">
          {forwardedAttachments.map((attachment) => <li key={attachment.id} className="flex items-center justify-between rounded-xl bg-[#FFF3F4] px-3 py-2 text-xs text-[#64748B]"><span className="truncate">{attachment.filename} · {(attachment.sizeBytes / 1024).toFixed(1)} KB · from original message</span><button type="button" aria-label={`Remove ${attachment.filename}`} onClick={() => setForwardedAttachments((current) => current.filter((item) => item.id !== attachment.id))}><X className="size-4" /></button></li>)}
          {files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between rounded-xl bg-[#FFF3F4] px-3 py-2 text-xs text-[#64748B]"><span className="truncate">{file.name} · {(file.size / 1024).toFixed(1)} KB</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X className="size-4" /></button></li>)}
        </ul>}
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">{error}</p>}
    {scheduleOpen && <section aria-label="Schedule delivery" className="mt-6 rounded-2xl border border-[#E7B8C1] bg-[#FFF3F4] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4"><div><h2 className="text-sm font-semibold text-[#183A5A]">Schedule delivery</h2><p className="mt-1 text-xs leading-5 text-[#64748B]">KYM Mail will send automatically using the approved message and sender.</p></div><button type="button" aria-label="Close scheduling" onClick={() => setScheduleOpen(false)} className="rounded-lg p-1 text-[#64748B]"><X className="size-4" /></button></div>
      <label className="mt-4 grid gap-2 text-sm font-semibold text-[#183A5A]">Date and time<input type="datetime-local" value={scheduledLocal} min={localInputValue(new Date(Date.now() + 60_000))} onChange={(event) => setScheduledLocal(event.target.value)} className="w-full rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" /></label>
      <p className="mt-3 text-sm font-semibold text-[#A73D52]">{schedulePreview}</p><p className="mt-1 text-xs text-[#64748B]">Timezone: {timezone}</p>
      <button type="button" onClick={() => void schedule()} disabled={status === "scheduling" || !identities.length || !from} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"><CalendarClock className="size-4" /> {status === "scheduling" ? "Scheduling…" : "Confirm schedule"}</button>
    </section>}
    <div className="mt-7 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setScheduleOpen((current) => !current)} disabled={status === "sending" || status === "scheduling" || !identities.length || !from} className="inline-flex items-center gap-2 rounded-full border border-[#D95B72] bg-[#FFFCFB] px-6 py-3 text-sm font-semibold text-[#A73D52] disabled:opacity-60"><CalendarClock className="size-4" /> Schedule send</button><button type="submit" disabled={status === "sending" || status === "scheduling" || !identities.length || !from} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64] disabled:cursor-not-allowed disabled:opacity-60"><Send className="size-4" /> {status === "sending" ? "Sending…" : draft?.mode === "reply" ? "Send reply" : draft?.mode === "forward" ? "Forward now" : "Send now"}</button></div>
  </form>;
}
