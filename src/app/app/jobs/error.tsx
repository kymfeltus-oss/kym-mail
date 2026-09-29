"use client";

export default function JobsError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-3xl border border-[#1D4E89] bg-[#122033] p-7"><h1 className="text-xl font-semibold text-[#F4F7FB]">Jobs could not be loaded</h1><p className="mt-2 text-sm leading-6 text-[#93A0B5]">The application could not load persisted job data. Your saved opportunities have not been replaced or fabricated.</p><button onClick={reset} className="mt-5 rounded-full kym-action px-5 py-2.5 text-sm font-semibold text-white">Try again</button></div>;
}
