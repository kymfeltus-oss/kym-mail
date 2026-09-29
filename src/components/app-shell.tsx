import Link from "next/link";
import { BookOpenCheck, BriefcaseBusiness, CalendarClock, CalendarDays, FileUser, FolderKanban, Inbox, LayoutDashboard, LogOut, Send, SquarePen, Users } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";
import { BrandLockup } from "@/components/brand-lockup";

type ActiveView = "dashboard" | "inbox" | "sent" | "scheduled" | "calendar" | "clients" | "projects" | "jobs" | "career" | "resumes" | "compose";
const navigation = [
  { href: "/app", label: "Home", desktopLabel: "Dashboard", icon: LayoutDashboard, active: "dashboard" as const },
  { href: "/app/inbox", label: "Inbox", desktopLabel: "Inbox", icon: Inbox, active: "inbox" as const },
  { href: "/app/sent", label: "Sent", desktopLabel: "Sent", icon: Send, active: "sent" as const },
  { href: "/app/scheduled", label: "Schedule", desktopLabel: "Scheduled", icon: CalendarClock, active: "scheduled" as const },
  { href: "/app/calendar", label: "Calendar", desktopLabel: "Calendar", icon: CalendarDays, active: "calendar" as const },
  { href: "/app/clients", label: "Clients", desktopLabel: "Clients", icon: Users, active: "clients" as const },
  { href: "/app/projects", label: "Projects", desktopLabel: "Projects", icon: FolderKanban, active: "projects" as const },
  { href: "/app/jobs", label: "Jobs", desktopLabel: "Jobs", icon: BriefcaseBusiness, active: "jobs" as const },
  { href: "/app/career", label: "Career", desktopLabel: "Career Profile", icon: BookOpenCheck, active: "career" as const },
  { href: "/app/resumes", label: "Resume", desktopLabel: "Resume", icon: FileUser, active: "resumes" as const },
  { href: "/app/compose", label: "Compose", desktopLabel: "Compose", icon: SquarePen, active: "compose" as const }
];

const itemClass = (selected: boolean) => selected
  ? "bg-[#10283A] text-[#F4F7FB] shadow-[inset_3px_0_0_#22D3EE]"
  : "text-[#93A0B5] hover:bg-white/5 hover:text-white";

export function AppShell({ email, canSignOut, active = "dashboard", children }: { email: string; canSignOut: boolean; active?: ActiveView; children: React.ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[276px_1fr]">
    <aside className="border-b border-[#1C283C] bg-[#070D18] px-5 py-5 text-white lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <BrandLockup href="/app" priority />
          <p className="mt-2 truncate text-xs text-[#93A0B5]">Owner workspace</p>
        </div>
        {canSignOut && <form action={signOut} className="lg:hidden"><button aria-label="Sign out" className="rounded-xl border border-white/15 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button></form>}
      </div>
      <nav aria-label="Primary" className="mt-8 hidden space-y-1.5 lg:block">
        {navigation.map((item) => {
          const Icon = item.icon;
          const selected = active === item.active;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${itemClass(selected)}`}><Icon className={`size-4 ${selected ? "text-[#22D3EE]" : ""}`} /> {item.desktopLabel}</Link>;
        })}
      </nav>
      <div className="mt-auto hidden border-t border-[#1C283C] pt-5 lg:block"><p className="truncate text-sm text-[#C5D0E0]">{email}</p>{canSignOut && <form action={signOut}><button className="mt-3 flex items-center gap-2 text-sm text-[#93A0B5] transition hover:text-white"><LogOut className="size-4" /> Sign out</button></form>}</div>
    </aside>
    <main className="min-w-0 px-5 py-8 pb-28 sm:px-8 lg:px-12 lg:py-12">{children}</main>
    <nav aria-label="Mobile primary" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-[#1C283C] bg-[#070D18]/95 p-2 text-white shadow-[0_18px_46px_rgba(0,0,0,.45)] backdrop-blur-xl lg:hidden">
      {navigation.map((item) => {
        const Icon = item.icon;
        const selected = active === item.active;
        return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-semibold transition ${selected ? "bg-[#10283A] text-[#F4F7FB]" : "text-[#93A0B5]"}`}><Icon className={`size-4 ${selected ? "text-[#22D3EE]" : ""}`} /><span className="truncate">{item.label}</span></Link>;
      })}
    </nav>
  </div>;
}
