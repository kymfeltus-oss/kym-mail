import Link from "next/link";
import { BrandLockup } from "@/components/brand-lockup";

export function ClientChrome({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#05070D] px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <BrandLockup href="/consult" />
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[#93A0B5]">
            {action}
            <Link href="/consult">Paid consultations</Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
