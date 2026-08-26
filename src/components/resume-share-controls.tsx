"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, LoaderCircle, ShieldOff } from "lucide-react";

export type ResumeShareView = { id: string; resumeVersionId: string; label: string | null; status: "ACTIVE" | "REVOKED"; createdAt: string; revokedAt: string | null; accessCount: number };

export function ResumeShareControls({ resumeId, versionId, shares }: { resumeId: string; versionId: string; shares: ResumeShareView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createShare() {
    setBusy("create"); setError(null); setNewUrl(null);
    try {
      const response = await fetch(`/api/resumes/${resumeId}/versions/${versionId}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Recipient resume" }) });
      const payload = await response.json() as { error?: string; url?: string };
      if (!response.ok || !payload.url) throw new Error(payload.error ?? "Share link could not be created.");
      setNewUrl(payload.url); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Share link could not be created."); }
    finally { setBusy(null); }
  }

  async function revoke(shareId: string) {
    setBusy(shareId); setError(null);
    try {
      const response = await fetch(`/api/resume-shares/${shareId}`, { method: "PATCH" });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Share link could not be revoked.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Share link could not be revoked."); }
    finally { setBusy(null); }
  }

  async function copy() {
    if (!newUrl) return;
    await navigator.clipboard.writeText(newUrl);
    setCopied(true);
  }

  return <section className="rounded-3xl border border-[#E7DBD8] bg-[#FFFDFC] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8D2948]">Recipient access</p><h2 className="mt-1 text-xl font-semibold text-[#3E1D2C]">Secure share links</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#70626A]">Tokens are unguessable and stored only as hashes. Recipients see only this approved snapshot—never Career Profile evidence or owner controls.</p></div><button type="button" disabled={Boolean(busy)} onClick={() => void createShare()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#8D2948] px-5 text-sm font-semibold text-white disabled:opacity-60">{busy === "create" ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />} Create Share Link</button></div>{newUrl && <div className="mt-5 rounded-2xl bg-[#F7F1F2] p-4"><p className="text-xs font-semibold text-[#3E1D2C]">Copy this link now. The raw token is not stored and cannot be recovered later.</p><div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row"><input readOnly value={newUrl} aria-label="New secure resume URL" className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#D8CAC8] bg-white px-3 text-xs text-[#554850]" /><button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#8D2948] px-4 text-xs font-semibold text-[#8D2948]">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}</button></div></div>}{error && <p role="alert" className="mt-4 rounded-2xl bg-[#FFF0F1] p-3 text-sm text-[#A73D52]">{error}</p>}<div className="mt-5 space-y-2">{shares.length ? shares.map((share) => <div key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E7DBD8] bg-white p-3"><div><p className="text-sm font-semibold text-[#3E1D2C]">{share.label ?? "Recipient resume"}</p><p className="mt-1 text-xs text-[#81747B]">{share.status} · {share.accessCount} view{share.accessCount === 1 ? "" : "s"} · Created {new Date(share.createdAt).toLocaleDateString()}</p></div>{share.status === "ACTIVE" && <button type="button" disabled={Boolean(busy)} onClick={() => void revoke(share.id)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#FFF0F1] px-4 text-xs font-semibold text-[#A73D52]"><ShieldOff className="size-4" /> Revoke</button>}</div>) : <p className="text-sm text-[#81747B]">No share links have been created for this version.</p>}</div></section>;
}
