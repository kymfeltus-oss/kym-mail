import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MasterResumeStudio } from "@/components/master-resume-studio";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadMasterResumeView } from "@/lib/resumes/master";

export const metadata = { title: "Master Resume" };

export default async function MasterResumePage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const resume = await loadMasterResumeView(owner.database, owner.user.id);
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="resumes"><main className="mx-auto max-w-7xl"><Link href="/app/resumes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#70626A]"><ArrowLeft className="size-4" /> Resume</Link><header className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8D2948]">Master Resume</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.05em] text-[#3E1D2C] sm:text-6xl">Your Master Resume.</h1><p className="mt-4 max-w-3xl text-sm leading-7 text-[#70626A]">This controls presentation, not facts. Every summary, accomplishment, metric, skill, project, education item, and credential remains grounded to the Master Career Profile.</p></header><MasterResumeStudio resume={resume} /></main></AppShell>;
}
