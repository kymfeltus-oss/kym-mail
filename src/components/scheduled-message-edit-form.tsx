"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Identity = { id: string; email_address: string; label: string };
type Project = { id: string; name: string };
type Message = { id: string; mail_account_id: string; project_id: string | null; to_addresses: string[]; cc_addresses: string[]; bcc_addresses: string[]; subject: string; text_body: string; version: number };

export function ScheduledMessageEditForm({ message, identities, projects, attachmentCount }: { message: Message; identities: Identity[]; projects: Project[]; attachmentCount: number }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/scheduled/${message.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "The scheduled email could not be updated.");
      router.push(`/app/scheduled/${message.id}?updated=true`); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The scheduled email could not be updated."); }
    finally { setWorking(false); }
  }

  return <form onSubmit={submit} className="glass rounded-3xl p-5 sm:p-8">
    <input type="hidden" name="version" value={message.version} />
    <div className="grid gap-5">
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Project<select name="projectId" defaultValue={message.project_id ?? ""} className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal"><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">From<select name="from" defaultValue={identities.find((identity) => identity.id === message.mail_account_id)?.email_address ?? ""} required className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal">{identities.map((identity) => <option key={identity.id} value={identity.email_address}>{identity.email_address} — {identity.label}</option>)}</select></label>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">To<input name="to" required defaultValue={message.to_addresses.join(", ")} className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal" /></label>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">CC<input name="cc" defaultValue={message.cc_addresses.join(", ")} className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal" /></label><label className="grid gap-2 text-sm font-semibold text-[#183A5A]">BCC<input name="bcc" defaultValue={message.bcc_addresses.join(", ")} className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal" /></label></div>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Subject<input name="subject" required maxLength={200} defaultValue={message.subject} className="rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal" /></label>
      <label className="grid gap-2 text-sm font-semibold text-[#183A5A]">Message<textarea name="body" required rows={12} defaultValue={message.text_body} className="resize-y rounded-xl border border-[#E8E2E3] bg-[#FFFCFB] px-4 py-3 font-normal leading-7" /></label>
      {attachmentCount > 0 && <p className="rounded-2xl bg-[#FFF3F4] px-4 py-3 text-xs leading-5 text-[#64748B]">{attachmentCount} approved attachment{attachmentCount === 1 ? " is" : "s are"} retained unchanged for delivery.</p>}
    </div>
    {error && <p role="alert" className="mt-5 rounded-xl bg-[#FFF3F4] px-4 py-3 text-sm text-[#A73D52]">{error}</p>}
    <div className="mt-7 flex justify-end"><button disabled={working} className="rounded-full bg-[#D95B72] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{working ? "Saving…" : "Save changes"}</button></div>
  </form>;
}
