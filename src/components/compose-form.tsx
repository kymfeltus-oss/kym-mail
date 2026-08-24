"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Send, X } from "lucide-react";

type Identity = { email_address: string; label: string; is_default: boolean };

export function ComposeForm({ identities, reply }: { identities: Identity[]; reply?: { to: string; subject: string; providerThreadId: string; replyToMessageId: string } }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [advanced, setAdvanced] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStatus("sending"); setError(null);
    const data = new FormData(event.currentTarget);
    data.delete("attachments"); files.forEach((file) => data.append("attachments", file));
    try {
      const response = await fetch("/api/mail/send", { method: "POST", body: data });
      const payload = await response.json() as { error?: string; sent?: boolean };
      if (!response.ok && !payload.sent) throw new Error(payload.error || "The message could not be sent.");
      formRef.current?.reset(); setFiles([]); router.push("/app/sent?sent=true"); router.refresh();
    } catch (cause) {
      setStatus("error"); setError(cause instanceof Error ? cause.message : "The message could not be sent.");
    }
  }

  return <form ref={formRef} onSubmit={submit} className="glass min-w-0 rounded-3xl p-5 sm:p-8">
    {reply && <><input type="hidden" name="providerThreadId" value={reply.providerThreadId} /><input type="hidden" name="replyToMessageId" value={reply.replyToMessageId} /></>}
    <div className="grid min-w-0 gap-5">
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">From
        <select name="from" defaultValue={identities.find((identity) => identity.is_default)?.email_address ?? identities[0]?.email_address} required className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal text-[#183A5A] outline-none focus:border-[#D95B72]">
          {identities.map((identity) => <option key={identity.email_address} value={identity.email_address}>{identity.email_address} — {identity.label}</option>)}
        </select>
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">To
        <input name="to" type="text" inputMode="email" required defaultValue={reply?.to} placeholder="recipient@example.com" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none placeholder:text-[#94A3B8] focus:border-[#D95B72]" />
      </label>
      {!advanced && <button type="button" onClick={() => setAdvanced(true)} className="w-fit text-xs font-semibold text-[#A73D52]">Add CC or BCC</button>}
      {advanced && <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">CC<input name="cc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" /></label>
        <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">BCC<input name="bcc" type="text" inputMode="email" className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" /></label>
      </div>}
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Subject
        <input name="subject" type="text" required maxLength={200} defaultValue={reply?.subject} className="w-full min-w-0 rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal outline-none focus:border-[#D95B72]" />
      </label>
      <label className="grid min-w-0 gap-2 text-sm font-semibold text-[#183A5A]">Message
        <textarea name="body" required rows={12} placeholder="Write your message…" className="w-full min-w-0 resize-y rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal leading-7 outline-none placeholder:text-[#94A3B8] focus:border-[#D95B72]" />
      </label>
      <div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#E8E2E3] px-4 py-2 text-xs font-semibold text-[#183A5A] transition hover:bg-[#FFF3F4]"><Paperclip className="size-4 text-[#D95B72]" /> Attach files<input name="attachments" type="file" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
        {files.length > 0 && <ul className="mt-3 space-y-2">{files.map((file, index) => <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between rounded-xl bg-[#FFF3F4] px-3 py-2 text-xs text-[#64748B]"><span className="truncate">{file.name} · {(file.size / 1024).toFixed(1)} KB</span><button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))}><X className="size-4" /></button></li>)}</ul>}
      </div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">{error}</p>}
    <div className="mt-7 flex justify-end"><button type="submit" disabled={status === "sending" || !identities.length} className="inline-flex items-center gap-2 rounded-full bg-[#D95B72] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(217,91,114,.22)] transition hover:bg-[#C94C64] disabled:cursor-wait disabled:opacity-60"><Send className="size-4" /> {status === "sending" ? "Sending…" : "Send email"}</button></div>
  </form>;
}
