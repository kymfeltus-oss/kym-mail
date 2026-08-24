import Link from "next/link";
import { Inbox, LogOut, Mail, Send, SquarePen } from "lucide-react";
import { signOut } from "@/app/sign-in/actions";

type ActiveView = "inbox" | "sent" | "compose";
const navigation = [
  { href: "/app", label: "Inbox", icon: Inbox, active: "inbox" as const },
  { href: "/app/sent", label: "Sent", icon: Send, active: "sent" as const },
  { href: "/app/compose", label: "Compose", icon: SquarePen, active: "compose" as const }
];

export function AppShell({ email, canSignOut, active = "inbox", children }: { email: string; canSignOut: boolean; active?: ActiveView; children: React.ReactNode }) {
  return <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
    <aside className="border-b border-[#264D6E] bg-[#183A5A] px-5 py-4 text-white lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
      <div className="flex items-center justify-between lg:block">
        <Link href="/app" className="flex items-center gap-3"><span className="brand-mark grid size-10 place-items-center rounded-2xl text-white"><Mail className="size-5" /></span><div><p className="font-semibold">KYM <span className="text-[#F3A0A0]">Mail</span></p><p className="text-xs text-white/55">Owner workspace</p></div></Link>
        {canSignOut && <form action={signOut} className="lg:hidden"><button aria-label="Sign out" className="rounded-xl border border-white/15 p-2 text-white/65 transition hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button></form>}
      </div>
      <nav aria-label="Primary" className="mt-4 flex gap-2 overflow-x-auto lg:mt-8 lg:block lg:space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon; const selected = active === item.active;
          return <Link key={item.href} href={item.href} aria-current={selected ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${selected ? "bg-[#F7DDE1] text-[#183A5A]" : "text-white/70 hover:bg-white/10 hover:text-white"}`}><Icon className={`size-4 ${selected ? "text-[#D95B72]" : ""}`} /> {item.label}</Link>;
        })}
      </nav>
      <div className="mt-[calc(100vh-22rem)] hidden border-t border-white/15 pt-5 lg:block"><p className="truncate text-sm text-white/80">{email}</p>{canSignOut && <form action={signOut}><button className="mt-3 flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><LogOut className="size-4" /> Sign out</button></form>}</div>
    </aside>
    <main className="px-5 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
  </div>;
}

