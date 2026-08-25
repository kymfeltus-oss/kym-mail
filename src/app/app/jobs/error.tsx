"use client";

export default function JobsError({ reset }: { reset: () => void }) {
  return <div className="mx-auto max-w-xl rounded-3xl border border-[#F0C9D0] bg-[#FFF3F4] p-7"><h1 className="text-xl font-semibold text-[#183A5A]">Jobs could not be loaded</h1><p className="mt-2 text-sm leading-6 text-[#64748B]">The application could not load persisted job data. Your saved opportunities have not been replaced or fabricated.</p><button onClick={reset} className="mt-5 rounded-full bg-[#D95B72] px-5 py-2.5 text-sm font-semibold text-white">Try again</button></div>;
}
