"use client";

export default function ScheduledError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-3xl border border-[#F0C9D0] bg-[#FFF3F4] p-8 text-center"><h1 className="text-xl font-semibold text-[#183A5A]">Scheduled mail is temporarily unavailable</h1><p className="mt-3 text-sm leading-6 text-[#64748B]">No delivery state was changed. Try loading this view again.</p><button onClick={reset} className="mt-5 rounded-full bg-[#D95B72] px-5 py-2.5 text-sm font-semibold text-white">Try again</button></div>;
}
