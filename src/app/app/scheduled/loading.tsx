export default function ScheduledLoading() {
  return <div className="mx-auto max-w-6xl animate-pulse"><div className="h-4 w-28 rounded bg-[#F7DDE1]" /><div className="mt-4 h-12 w-64 rounded-2xl bg-[#F7DDE1]" /><div className="mt-10 space-y-4">{[1, 2, 3].map((item) => <div key={item} className="h-36 rounded-3xl bg-[#FFF3F4]" />)}</div></div>;
}
