"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, BadgeCheck, Building2, Check, ChevronDown, ExternalLink, LoaderCircle, Mail, RefreshCw, Search, ShieldQuestion, Star, UserPlus, Users } from "lucide-react";
import type { ContactEmailStatus, ContactIntelligenceView } from "@/lib/contacts/types";

const statusStyles: Record<ContactEmailStatus, string> = {
  VERIFIED: "bg-[#E7F7EF] text-[#176B4C]",
  DELIVERABLE: "bg-[#E7F7EF] text-[#176B4C]",
  LIKELY: "bg-[#FFF2D9] text-[#865500]",
  UNVERIFIED: "bg-[#EEF2F6] text-[#526579]",
  RISKY: "bg-[#FFF2D9] text-[#865500]",
  INVALID: "bg-[#FFF0F1] text-[#A73D52]",
  NOT_FOUND: "bg-[#EEF2F6] text-[#526579]"
};

function ProviderRow({ label, provider }: { label: string; provider: string | null }) {
  return <div className="flex items-center justify-between gap-3 border-b border-[#E8E2E3] py-2 last:border-0"><span className="text-sm text-[#64748B]">{label}</span><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${provider ? "bg-[#E7F7EF] text-[#176B4C]" : "bg-[#FFF0F1] text-[#A73D52]"}`}>{provider ?? "Not configured"}</span></div>;
}

export function ContactIntelligenceWorkspace({ jobId, jobTitle, companyName, initial }: { jobId: string; jobTitle: string; companyName: string; initial: ContactIntelligenceView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const providerReady = Boolean(initial.providerConfiguration.people);

  async function action(body: Record<string, unknown>, label: string) {
    setBusy(label); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/jobs/${jobId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json() as { error?: string; discovered?: number };
      if (!response.ok) throw new Error(payload.error ?? "Contact request failed.");
      setNotice(label === "preferred" ? "Preferred contact saved." : label === "manual" ? "Manual contact saved with user-entered provenance." : `Contact search completed with ${payload.discovered ?? 0} discovered people.`);
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Contact request failed.");
      router.refresh();
      return false;
    } finally { setBusy(null); }
  }

  async function submitManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const saved = await action({
      action: "MANUAL_ADD",
      fullName: form.get("fullName"),
      currentTitle: form.get("currentTitle"),
      department: form.get("department"),
      seniority: form.get("seniority"),
      location: form.get("location"),
      professionalProfileUrl: form.get("professionalProfileUrl"),
      email: form.get("email"),
      emailType: form.get("emailType")
    }, "manual");
    if (saved) { formElement.reset(); setManualOpen(false); }
  }

  return <div className="mt-7 space-y-6">
    <section className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,.65fr)]">
      <div className="min-w-0 rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_20px_60px_rgba(24,58,90,.08)] sm:p-7">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Target organization</p><h2 className="mt-2 flex items-center gap-2 break-words text-2xl font-semibold text-[#183A5A]"><Building2 className="size-5 shrink-0 text-[#D95B72]" />{initial.organization?.canonicalName ?? companyName}</h2><p className="mt-2 text-sm leading-6 text-[#64748B]">{initial.organization?.domain ? `Domain: ${initial.organization.domain}` : "A company domain has not been verified."}</p></div><span className="w-fit rounded-full bg-[#FFF3F4] px-3 py-1.5 text-xs font-semibold text-[#A73D52]">{initial.search?.status.replaceAll("_", " ") ?? "NOT SEARCHED"}</span></div>
        <p className="mt-5 text-sm leading-6 text-[#465B70]">KYM Mail uses the saved job title and Career Match context to target likely decision-makers for <strong>{jobTitle}</strong>. It does not claim someone is the hiring manager without provider evidence.</p>
        {initial.search?.targetRoles.length ? <details className="mt-4 rounded-2xl bg-[#FFF3F4] p-4"><summary className="cursor-pointer text-sm font-semibold text-[#183A5A]">Targeted leadership roles</summary><ol className="mt-3 space-y-2">{initial.search.targetRoles.map((role) => <li key={`${role.title}-${role.priority}`} className="text-xs leading-5 text-[#64748B]"><strong className="text-[#183A5A]">{role.title}</strong> · priority {role.priority}<br />{role.reason}</li>)}</ol></details> : null}
        {!providerReady && <p className="mt-5 flex items-start gap-2 rounded-2xl bg-[#FFF0F1] p-4 text-sm leading-6 text-[#A73D52]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />A real people-discovery provider is not configured. KYM Mail will not create sample contacts. Manual professional contacts may still be saved and remain explicitly labeled as user-entered.</p>}
        {initial.search?.failureMessage && <p className="mt-4 rounded-2xl bg-[#FFF0F1] p-4 text-sm text-[#A73D52]">{initial.search.failureMessage}</p>}
        {notice && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-[#E7F7EF] p-3 text-sm text-[#176B4C]"><Check className="size-4" />{notice}</p>}
        {error && <p role="alert" className="mt-4 rounded-2xl bg-[#FFF0F1] p-3 text-sm text-[#A73D52]">{error}</p>}
        <div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => void action({ action: initial.search ? "REFRESH" : "SEARCH" }, "search")} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white disabled:bg-[#D7A6AF]">{busy === "search" ? <LoaderCircle className="size-4 animate-spin" /> : initial.search ? <RefreshCw className="size-4" /> : <Search className="size-4" />}{initial.search ? "Refresh Contacts" : "Find Hiring Contacts"}</button><button type="button" onClick={() => setManualOpen((value) => !value)} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[#D95B72] px-5 py-3 text-sm font-semibold text-[#A73D52]"><UserPlus className="size-4" /> Add Contact Manually</button></div>
      </div>
      <aside className="min-w-0 rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)]"><h2 className="flex items-center gap-2 text-lg font-semibold text-[#183A5A]"><ShieldQuestion className="size-5 text-[#D95B72]" /> Provider status</h2><div className="mt-3"><ProviderRow label="People discovery" provider={initial.providerConfiguration.people} /><ProviderRow label="Email discovery" provider={initial.providerConfiguration.email} /><ProviderRow label="Email verification" provider={initial.providerConfiguration.verification} /></div><p className="mt-4 text-xs leading-5 text-[#64748B]">Provider credentials remain server-side. Missing providers produce an explicit partial state rather than fabricated results.</p></aside>
    </section>

    {manualOpen && <form onSubmit={submitManual} className="rounded-[2rem] border border-[#E8E2E3] bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-7"><h2 className="text-xl font-semibold text-[#183A5A]">Add a professional contact</h2><p className="mt-2 text-sm text-[#64748B]">The company is locked to {initial.organization?.canonicalName ?? companyName}. Manual identity and email claims remain USER_ENTERED and unverified.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-[#183A5A]">Full name *<input name="fullName" required minLength={2} maxLength={160} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Current title *<input name="currentTitle" required minLength={2} maxLength={200} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Department<input name="department" maxLength={120} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Seniority<input name="seniority" maxLength={80} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Location<input name="location" maxLength={200} className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Professional profile URL<input name="professionalProfileUrl" type="url" placeholder="https://" className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Email address<input name="email" type="email" className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]" /></label><label className="text-sm font-semibold text-[#183A5A]">Email type<select name="emailType" defaultValue="UNKNOWN" className="mt-2 min-h-11 w-full rounded-xl border border-[#E8E2E3] bg-white px-3 font-normal text-[#465B70]"><option value="UNKNOWN">Unknown</option><option value="BUSINESS">Business</option><option value="PERSONAL">Personal — explicitly entered</option></select></label></div><button type="submit" disabled={Boolean(busy)} className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-full bg-[#183A5A] px-5 py-3 text-sm font-semibold text-white disabled:bg-[#7B8EA0]">{busy === "manual" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save Manual Contact</button></form>}

    <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#D95B72]">Ranked contact set</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-[#183A5A]"><Users className="size-6 text-[#D95B72]" />{initial.contacts.length} professional contact{initial.contacts.length === 1 ? "" : "s"}</h2></div><p className="text-xs text-[#64748B]">Scores are deterministic, not generated by an LLM.</p></div>
      {initial.contacts.length === 0 ? <div className="mt-5 rounded-[2rem] border border-dashed border-[#D7CDD0] bg-[#FFFCFB] p-8 text-center"><Mail className="mx-auto size-8 text-[#D95B72]" /><h3 className="mt-3 text-xl font-semibold text-[#183A5A]">No verified leadership contact found yet.</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#64748B]">Configure a legitimate contact provider, retry later, broaden to recruiting contacts through a provider, or add a professional contact manually.</p></div> : <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-2">{initial.contacts.map((contact) => <article key={contact.id} className={`min-w-0 rounded-[2rem] border bg-[#FFFCFB] p-5 shadow-[0_14px_42px_rgba(24,58,90,.06)] sm:p-6 ${contact.isPreferred ? "border-[#D95B72]" : "border-[#E8E2E3]"}`}><div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words text-xl font-semibold text-[#183A5A]">{contact.fullName}</h3>{contact.isPreferred && <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF3F4] px-2.5 py-1 text-xs font-semibold text-[#A73D52]"><Star className="size-3 fill-current" /> Preferred</span>}{contact.status === "STALE" && <span className="rounded-full bg-[#FFF2D9] px-2.5 py-1 text-xs font-semibold text-[#865500]">Stale</span>}</div><p className="mt-1 break-words text-sm font-semibold text-[#465B70]">{contact.currentTitle}</p><p className="mt-1 break-words text-sm text-[#64748B]">{contact.companyName}{contact.location ? ` · ${contact.location}` : ""}</p></div><span className="shrink-0 rounded-2xl bg-[#183A5A] px-3 py-2 text-sm font-semibold text-white">{contact.relevanceScore}</span></div><div className="mt-4 flex flex-wrap gap-2">{contact.classifications.map((item) => <span key={item} className="rounded-full bg-[#FFF3F4] px-2.5 py-1 text-[11px] font-semibold text-[#A73D52]">{item.replaceAll("_", " ")}</span>)}</div><div className="mt-5 space-y-2">{contact.emails.length ? contact.emails.map((email) => <div key={email.id} className="min-w-0 rounded-2xl border border-[#E8E2E3] bg-white p-3"><div className="flex min-w-0 flex-wrap items-center justify-between gap-2"><span className="break-all text-sm font-semibold text-[#183A5A]">{email.email}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[email.status]}`}>{email.status}{email.isPatternBased ? " · PATTERN-BASED" : ""}</span></div><p className="mt-1 text-xs text-[#64748B]">Source: {email.sourceProvider}{email.verifiedAt ? ` · verified ${new Date(email.verifiedAt).toLocaleDateString()}` : " · not provider-verified"}</p></div>) : <p className="rounded-2xl bg-[#EEF2F6] p-3 text-sm text-[#64748B]">No business email found.</p>}</div><div className="mt-5"><h4 className="text-sm font-semibold text-[#183A5A]">Why recommended</h4><ul className="mt-2 space-y-1.5 text-xs leading-5 text-[#64748B]">{contact.relevanceReasons.map((reason) => <li key={reason} className="flex gap-2"><BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-[#D95B72]" />{reason}</li>)}</ul></div><details className="mt-4 rounded-2xl bg-[#FFF3F4] p-3"><summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#183A5A]"><ChevronDown className="size-3.5" /> Evidence & provenance</summary><div className="mt-3 space-y-2">{contact.sources.map((source) => <p key={source.id} className="text-xs leading-5 text-[#64748B]"><strong className="text-[#183A5A]">{source.fieldName.replaceAll("_", " ")}:</strong> {source.claimSummary}<br />{source.sourceType.replaceAll("_", " ")} · {source.providerKey} · confidence {source.confidence}{source.sourceUrl && <> · <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[#A73D52]">Source <ExternalLink className="size-3" /></a></>}</p>)}</div></details>{!contact.isPreferred && <button type="button" onClick={() => void action({ action: "SELECT_PREFERRED", contactId: contact.id }, "preferred")} disabled={Boolean(busy)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D95B72] px-4 text-sm font-semibold text-[#A73D52]"><Star className="size-4" /> Select as Preferred</button>}</article>)}</div>}
    </section>
  </div>;
}
