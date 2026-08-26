import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExecutiveResume, toPublicResume } from "@/components/executive-resume";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { resumeContentSchema } from "@/lib/resumes/types";

export const metadata = { title: "Resume Preview" };

export default async function ResumePreviewPage({ params }: { params: Promise<{ resumeId: string; versionId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) redirect("/sign-in");
  const { resumeId, versionId } = await params;
  const { data: version, error } = await owner.database.from("tailored_resume_versions").select("status, approved_at, content, tailored_resumes!tailored_resume_versions_resume_id_fkey(job_opportunity_id)").eq("id", versionId).eq("resume_id", resumeId).eq("owner_id", owner.user.id).maybeSingle();
  if (error || !version || !version.approved_at || !["APPROVED", "STALE"].includes(version.status)) notFound();
  const relation = Array.isArray(version.tailored_resumes) ? version.tailored_resumes[0] : version.tailored_resumes;
  return <main className="min-h-screen bg-[#ECE6E3] px-3 py-3 sm:px-6 sm:py-8 lg:px-10"><div className="mx-auto max-w-6xl"><Link href={`/app/jobs/saved/${relation?.job_opportunity_id ?? ""}/resume`} className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#6D3F50]"><ArrowLeft className="size-4" /> Resume Studio</Link><ExecutiveResume content={toPublicResume(resumeContentSchema.parse(version.content))} /></div></main>;
}
