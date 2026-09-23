import Image from "next/image";
import Link from "next/link";

export function ClientChrome({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#F7F3F2] px-4 py-6 sm:px-8 lg:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/consult" className="flex items-center gap-3">
            <span className="grid size-11 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm">
              <Image src="/kym-mail-logo.png" alt="KYM Mail" width={44} height={44} className="size-11 object-cover" />
            </span>
            <span className="font-semibold tracking-[.04em] text-[#183A5A]">KYM <span className="text-[#D95B72]">MAIL</span></span>
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[#526173]">
            {action}
            <Link href="/consult">Paid consultations</Link>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}
