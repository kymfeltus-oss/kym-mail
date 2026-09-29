"use client";

export default function ScheduledError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-3xl border border-[#1D4E89] bg-[#122033] p-8 text-center"><h1 className="text-xl font-semibold text-[#F4F7FB]">Scheduled mail is temporarily unavailable</h1><p className="mt-3 text-sm leading-6 text-[#93A0B5]">No delivery state was changed. Try loading this view again.</p><button onClick={reset} className="mt-5 rounded-full kym-action px-5 py-2.5 text-sm font-semibold text-white">Try again</button></div>;
}
