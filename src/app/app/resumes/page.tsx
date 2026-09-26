import Link from "next/link";
import { redirect } from "next/navigation";
import { FilePlus2, FileUser } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { loadApprovedMasterResume } from "@/lib/resumes/master";
import { listResumeTargets } from "@/lib/resumes/target/store";

export const metadata = { title: "Resume" };

export default async function ResumeHubPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const [master, targets] = await Promise.all([
    loadApprovedMasterResume(owner.database, owner.user.id),
    listResumeTargets(owner.database, owner.user.id)
  ]);
  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="resumes">
      <main className="mx-auto max-w-6xl">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8D2948]">Resume</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.05em] text-[#3E1D2C] sm:text-6xl">Your versions.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#70626A]">Master Resume stays the baseline. Targeted versions are a separate studio: drop in a job description, confirm what you have, and write a professional page that still sounds like you.</p>
        </header>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Link href="/app/resumes/master" className="rounded-[2rem] border border-[#E7DBD8] bg-[#FFFDFC] p-6 shadow-[0_18px_54px_rgba(73,24,42,.06)]">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#8D2948]">Baseline</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-[#3E1D2C]"><FileUser className="size-6" /> Master Resume</h2>
            <p className="mt-3 text-sm leading-6 text-[#70626A]">{master ? "Approved presentation baseline." : "Build and approve the Master Resume when you want a general-purpose version."}</p>
          </Link>
          <Link href="/app/resumes/targets/new" className="rounded-[2rem] border border-[#111111] bg-[#111111] p-6 text-[#F7F1E6] shadow-[0_18px_54px_rgba(17,17,17,.18)]">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#C4A574]">Targeted version</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold"><FilePlus2 className="size-6 text-[#C4A574]" /> New from job description</h2>
            <p className="mt-3 text-sm leading-6 text-[#E8D9B8]">Paste a brief. Confirm unmatched experience. Get a version written for that role.</p>
          </Link>
        </div>
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-[#3E1D2C]">Targeted resumes</h2>
          <div className="mt-4 space-y-3">
            {targets.length ? targets.map((item) => (
              <Link key={item.id} href={`/app/resumes/targets/${item.id}`} className="block rounded-2xl border border-[#E7DBD8] bg-white px-5 py-4">
                <p className="text-sm font-semibold text-[#3E1D2C]">{item.title}</p>
                <p className="mt-1 text-xs text-[#70626A]">{item.employer} · {item.status.toLowerCase()}</p>
              </Link>
            )) : <p className="rounded-2xl bg-[#FFF8F8] p-5 text-sm text-[#70626A]">No targeted versions yet. Drop in a job description to start one.</p>}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
