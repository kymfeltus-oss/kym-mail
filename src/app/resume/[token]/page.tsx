import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExecutiveResume, toPublicResume } from "@/components/executive-resume";
import { resumeContentSchema } from "@/lib/resumes/types";
import { hashResumeShareToken, isResumeShareToken } from "@/lib/resumes/shares";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Executive Resume", robots: { index: false, follow: false, noarchive: true, nocache: true } };

export default async function SharedResumePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isResumeShareToken(token)) notFound();
  const database = createSupabaseAdminClient();
  const tokenHash = hashResumeShareToken(token);
  const { data: share, error } = await database.from("resume_shares").select("id, resume_version_id, status, access_count").eq("token_hash", tokenHash).maybeSingle();
  if (error || !share || share.status !== "ACTIVE") notFound();
  const { data: version, error: versionError } = await database.from("tailored_resume_versions").select("status, approved_at, content").eq("id", share.resume_version_id).maybeSingle();
  if (versionError || !version || !version.approved_at || !["APPROVED", "STALE"].includes(version.status)) notFound();
  const content = toPublicResume(resumeContentSchema.parse(version.content));
  await database.from("resume_shares").update({ last_accessed_at: new Date().toISOString(), access_count: Number(share.access_count ?? 0) + 1 }).eq("id", share.id).eq("status", "ACTIVE");
  return <main className="min-h-screen bg-[#ECE6E3] px-3 py-3 sm:px-6 sm:py-8 lg:px-10"><div className="mx-auto max-w-6xl"><ExecutiveResume content={content} /><footer className="py-8 text-center text-[10px] font-semibold uppercase tracking-[.2em] text-[#806F77]">Private recipient view · KYM Mail</footer></div></main>;
}
