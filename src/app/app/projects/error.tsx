"use client";

export default function ProjectsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-2xl px-5 py-16 text-center"><p className="text-xs font-semibold uppercase tracking-[.22em] text-[#22D3EE]">Projects unavailable</p><h1 className="mt-3 text-3xl font-semibold text-[#F4F7FB]">We couldn’t load this Project view.</h1><p className="mt-3 text-sm leading-6 text-[#93A0B5]">Your saved data was not changed. Try loading the view again.</p><button onClick={reset} className="mt-6 rounded-full kym-action px-5 py-3 text-sm font-semibold text-white">Try again</button></div>;
}
