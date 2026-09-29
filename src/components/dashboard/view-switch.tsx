import Link from "next/link";

export function DashboardViewSwitch({
  view,
  mailError,
  mailConnected
}: {
  view: "admin" | "user";
  mailError?: string;
  mailConnected?: string;
}) {
  function href(next: "admin" | "user") {
    const params = new URLSearchParams();
    if (next === "user") params.set("view", "user");
    if (mailError) params.set("mailError", mailError);
    if (mailConnected) params.set("mailConnected", mailConnected);
    const query = params.toString();
    return query ? `/app?${query}` : "/app";
  }

  const options = [
    { id: "admin" as const, label: "Admin view", hint: "Review bookings and run the workspace" },
    { id: "user" as const, label: "User view", hint: "See the live public booking page" }
  ];

  return (
    <nav aria-label="Dashboard view" className="inline-flex w-full rounded-full border border-[#1C283C] bg-[#101828] p-1 shadow-[0_8px_24px_rgba(0,0,0,.05)] sm:w-auto">
      {options.map((option) => {
        const selected = view === option.id;
        return (
          <Link
            key={option.id}
            href={href(option.id)}
            aria-current={selected ? "page" : undefined}
            title={option.hint}
            className={`flex-1 rounded-full px-4 py-2.5 text-center text-sm font-semibold transition sm:flex-none sm:px-5 ${selected ? "bg-[#0E1C33] text-white" : "text-[#93A0B5] hover:bg-[#05070D]"}`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}
