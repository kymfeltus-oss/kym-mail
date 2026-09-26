import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ResumeTargetIntake } from "@/components/resume-target-intake";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "New Targeted Resume" };

export default async function NewTargetedResumePage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  return (
    <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="resumes">
      <main className="mx-auto max-w-4xl">
        <Link href="/app/resumes" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#70626A]"><ArrowLeft className="size-4" /> Resume</Link>
        <header className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#8A6A32]">Targeted resume</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-.05em] text-[#3E1D2C] sm:text-5xl">Drop in the job description.</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#70626A]">This studio does not use Jobs or Career Match. It reads the brief against your Career Profile, then asks you about anything that does not already have evidence.</p>
        </header>
        <ResumeTargetIntake />
      </main>
    </AppShell>
  );
}
