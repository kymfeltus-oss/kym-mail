import Image from "next/image";
import Link from "next/link";
import { BookOpenCheck, BriefcaseBusiness, CalendarClock, CalendarDays, FileUser, FolderKanban, Inbox, LayoutDashboard, LogOut, Send, SquarePen } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";

type ActiveView = "dashboard" | "inbox" | "sent" | "scheduled" | "calendar" | "projects" | "jobs" | "career" | "resumes" | "compose";
const navigation = [
  { href: "/app", label: "Home", desktopLabel: "Dashboard", icon: LayoutDashboard, active: "dashboard" as const },
  { href: "/app/inbox", label: "Inbox", desktopLabel: "Inbox", icon: Inbox, active: "inbox" as const },
  { href: "/app/sent", label: "Sent", desktopLabel: "Sent", icon: Send, active: "sent" as const },
  { href: "/app/scheduled", label: "Schedule", desktopLabel: "Scheduled", icon: CalendarClock, active: "scheduled" as const },
  { href: "/app/calendar", label: "Calendar", desktopLabel: "Calendar", icon: CalendarDays, active: "calendar" as const },
  { href: "/app/projects", label: "Projects", desktopLabel: "Projects", icon: FolderKanban, active: "projects" as const },
  { href: "/app/jobs", label: "Jobs", desktopLabel: "Jobs", icon: BriefcaseBusiness, active: "jobs" as const },
  { href: "/app/career", label: "Career", desktopLabel: "Career Profile", icon: BookOpenCheck, active: "career" as const },
  { href: "/app/resumes/master", label: "Resume", desktopLabel: "Master Resume", icon: FileUser, active: "resumes" as const },
  { href: "/app/compose", label: "Compose", desktopLabel: "Compose", icon: SquarePen, active: "compose" as const }
];

function Brand() {
  return <Link href="/app" className="flex min-w-0 items-center gap-3">
    <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-[#FFFCFB] shadow-[0_10px_24px_rgba(8,27,46,.24)]"><Image src="/kym-mail-logo.png" alt="KYM Mail" width={44} height={44} priority className="size-11 object-cover" /></span>
    <div className="min-w-0"><p className="font-semibold tracking-[.04em] text-white">KYM <span className="text-[#F3A0A0]">MAIL</span></p><p className="truncate text-xs text-white/55">Owner workspace</p></div>
  </Link>;
}

export function AppShell({ email, canSignOut, active = "dashboard", children }: { email: string; canSignOut: boolean; active?: ActiveView; children: React.ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[276px_1fr]">
    <aside className="border-b border-[#264D6E] bg-[#183A5A] px-5 py-4 text-white lg:flex lg:min-h-screen lg:flex-col lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
      <div className="flex items-center justify-between gap-4"><Brand />{canSignOut && <form action={signOut} className="lg:hidden"><button aria-label="Sign out" className="rounded-xl border border-white/15 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button></form>}</div>
      <nav aria-label="Primary" className="mt-9 hidden space-y-2 lg:block">
        {navigation.map((item) => {
          const Icon = item.icon; const selected = active === item.active;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${selected ? "bg-[#F7DDE1] text-[#183A5A]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><Icon className={`size-4 ${selected ? "text-[#D95B72]" : ""}`} /> {item.desktopLabel}</Link>;
        })}
      </nav>
      <div className="mt-auto hidden border-t border-white/15 pt-5 lg:block"><p className="truncate text-sm text-white/80">{email}</p>{canSignOut && <form action={signOut}><button className="mt-3 flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><LogOut className="size-4" /> Sign out</button></form>}</div>
    </aside>
    <main className="min-w-0 px-5 py-8 pb-44 sm:px-8 lg:px-12 lg:py-12">{children}</main>
    <nav aria-label="Mobile primary" className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/15 bg-[#183A5A]/95 p-2 text-white shadow-[0_18px_46px_rgba(24,58,90,.28)] backdrop-blur-xl lg:hidden">
      {navigation.map((item) => { const Icon = item.icon; const selected = active === item.active; return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[9px] font-semibold transition ${selected ? "bg-[#F7DDE1] text-[#183A5A]" : "text-white/65"}`}><Icon className={`size-4 ${selected ? "text-[#D95B72]" : ""}`} /><span className="truncate">{item.label}</span></Link>; })}
    </nav>
  </div>;
}
