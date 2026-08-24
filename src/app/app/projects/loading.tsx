export default function ProjectsLoading() {
  return <div className="mx-auto max-w-6xl animate-pulse px-5 py-8 sm:px-8 lg:px-12 lg:py-12"><div className="h-3 w-36 rounded bg-[#F7DDE1]" /><div className="mt-4 h-10 w-56 rounded-xl bg-[#E8E2E3]" /><div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-64 rounded-3xl border border-[#E8E2E3] bg-[#FFFCFB]" />)}</div></div>;
}
