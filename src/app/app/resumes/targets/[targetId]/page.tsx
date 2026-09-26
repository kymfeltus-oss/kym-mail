import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResumeTargetStudio } from "@/components/resume-target-studio";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadResumeTarget } from "@/lib/resumes/target/store";

export const metadata = { title: "Targeted Resume" };

export default async function TargetedResumePage({ params }: { params: Promise<{ targetId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { targetId } = await params;
  const target = await loadResumeTarget(owner.database, owner.user.id, targetId);
  if (!target) notFound();
  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="resumes">
      <main className="mx-auto max-w-6xl">
        <Link href="/app/resumes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#70626A]"><ArrowLeft className="size-4" /> Resume</Link>
        <header className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8A6A32]">Targeted resume</p>
          <h1 className="mt-2 break-words text-4xl font-semibold tracking-[-.05em] text-[#3E1D2C] sm:text-5xl">{target.title}</h1>
          <p className="mt-2 text-base font-semibold text-[#70626A]">{target.employer}</p>
        </header>
        <ResumeTargetStudio target={target} />
      </main>
    </AppShell>
  );
}
