"use client";

export default function ProjectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-2xl px-5 py-16 text-center"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Projects unavailable</p><h1 className="mt-3 text-3xl font-semibold text-[#183A5A]">We couldn’t load this Project view.</h1><p className="mt-3 text-sm leading-6 text-[#64748B]">Your saved data was not changed. Try loading the view again.</p><button onClick={reset} className="mt-6 rounded-full bg-[#D95B72] px-5 py-3 text-sm font-semibold text-white">Try again</button></div>;
}
