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
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Resume</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.05em] text-[#F4F7FB] sm:text-6xl">Your versions.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#93A0B5]">Master Resume stays the baseline. Targeted versions are a separate studio: drop in a job description, confirm what you have, and write a professional page that still sounds like you.</p>
        </header>
        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <Link href="/app/resumes/master" className="rounded-[2rem] border border-[#1C283C] bg-[#101828] p-6 shadow-[0_18px_54px_rgba(0,0,0,.06)]">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#22D3EE]">Baseline</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-[#F4F7FB]"><FileUser className="size-6" /> Master Resume</h2>
            <p className="mt-3 text-sm leading-6 text-[#93A0B5]">{master ? "Approved presentation baseline." : "Build and approve the Master Resume when you want a general-purpose version."}</p>
          </Link>
          <Link href="/app/resumes/targets/new" className="rounded-[2rem] border border-[#1C283C] bg-[#05070D] p-6 text-[#F4F7FB] shadow-[0_18px_54px_rgba(17,17,17,.18)]">
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#22D3EE]">Targeted version</p>
            <h2 className="mt-2 flex items-center gap-2 text-2xl font-semibold"><FilePlus2 className="size-6 text-[#22D3EE]" /> New from job description</h2>
            <p className="mt-3 text-sm leading-6 text-[#F4F7FB]">Paste a brief. Identify a hidden employer when the clues support it. Confirm unmatched experience. Get a version written for that role.</p>
          </Link>
        </div>
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-[#F4F7FB]">Targeted resumes</h2>
          <div className="mt-4 space-y-3">
            {targets.length ? targets.map((item) => (
              <Link key={item.id} href={`/app/resumes/targets/${item.id}`} className="block rounded-2xl border border-[#1C283C] bg-[#101828] px-5 py-4">
                <p className="text-sm font-semibold text-[#F4F7FB]">{item.title}</p>
                <p className="mt-1 text-xs text-[#93A0B5]">{item.employer} · {item.status.toLowerCase()}</p>
              </Link>
            )) : <p className="rounded-2xl bg-[#2A1218] p-5 text-sm text-[#93A0B5]">No targeted versions yet. Drop in a job description to start one.</p>}
          </div>
        </section>
      </main>
    </AppShell>
  );
}
