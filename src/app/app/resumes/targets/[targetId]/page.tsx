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
  const { data: projectRows } = await owner.database.from("career_projects").select("id, canonical_name, summary, impact").eq("owner_id", owner.user.id).in("authority_status", ["AUTHORITATIVE", "RESOLVED"]).order("canonical_name");
  const projectCatalog = ((projectRows ?? []) as Array<{ id: string; canonical_name: string; summary: string; impact: string | null }>)
    .filter((item) => !/documented in the authoritative career portfolio source/i.test(item.summary))
    .map((item) => ({ id: item.id, name: item.canonical_name, summary: item.summary, impact: item.impact }));
  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="resumes">
      <main className="mx-auto max-w-6xl">
        <Link href="/app/resumes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#93A0B5]"><ArrowLeft className="size-4" /> Resume</Link>
        <header className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Targeted resume</p>
          <h1 className="mt-2 break-words text-4xl font-semibold tracking-[-.05em] text-[#F4F7FB] sm:text-5xl">{target.title}</h1>
          <p className="mt-2 text-base font-semibold text-[#93A0B5]">{target.employer}</p>
        </header>
        <ResumeTargetStudio target={target} projectCatalog={projectCatalog} />
      </main>
    </AppShell>
  );
}
