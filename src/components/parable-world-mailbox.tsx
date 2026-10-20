import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Radio, Send } from "lucide-react";

export function ParableWorldMailbox({ unreadCount, threadCount, identityCount }: {
  unreadCount: number;
  threadCount: number;
  identityCount: number;
}) {
  return <section className="parable-mailbox relative isolate overflow-hidden rounded-[2rem] border border-cyan-300/35 px-5 py-6 shadow-[0_22px_80px_rgba(0,211,255,.13)] sm:px-8 sm:py-9">
    <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[#030712]" />
    <div aria-hidden="true" className="absolute -left-24 top-8 -z-10 size-72 rounded-full bg-cyan-400/15 blur-3xl" />
    <div aria-hidden="true" className="absolute -right-24 -top-20 -z-10 size-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
    <div aria-hidden="true" className="parable-mailbox-grid absolute inset-0 -z-10 opacity-50" />

    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(270px,.58fr)] lg:gap-10">
      <div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-[.26em] text-cyan-200">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5"><Radio className="size-3" /> Signal desk</span>
          <span>Communications // 01</span>
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[.28em] text-[#7eeeff]">PARABLE WORLD</p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-.05em] text-white sm:text-5xl">A clearer signal for every conversation.</h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">A focused inbox for ministry operations, built for clear communication and fast response.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/app/compose?brand=parable" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#062533] transition hover:bg-cyan-100"><Send className="size-4" /> Compose signal</Link>
          <Link href="/app/sent" className="inline-flex items-center gap-2 rounded-full border border-cyan-200/30 bg-cyan-200/5 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-200/10">View sent <ArrowUpRight className="size-4" /></Link>
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-sm">
        <div className="absolute inset-x-5 top-8 h-48 rounded-[2rem] bg-cyan-400/15 blur-3xl" aria-hidden="true" />
        <div className="relative rounded-[1.7rem] border border-white/10 bg-[#060c18]/85 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_16px_50px_rgba(0,0,0,.35)] backdrop-blur-xl">
          <Image src="/brand/parable-world-neon-lockup.png" alt="PARABLE WORLD Virtual Ministry Operating System" width={1672} height={941} priority className="h-auto w-full rounded-[1.15rem] border border-cyan-300/10" />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Unread" value={unreadCount} accent="text-cyan-200" />
            <Metric label="Threads" value={threadCount} accent="text-blue-200" />
            <Metric label="Senders" value={identityCount} accent="text-fuchsia-200" />
          </div>
        </div>
      </div>
    </div>
  </section>;
}

function Metric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.045] px-3 py-3">
    <p className={`text-lg font-semibold tabular-nums ${accent}`}>{value}</p>
    <p className="mt-1 text-[9px] font-bold uppercase tracking-[.16em] text-slate-400">{label}</p>
  </div>;
}
