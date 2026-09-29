"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function LandingNav({ items }: { items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-white/15 px-3 text-xs font-semibold text-white"
      >
        {open ? <X className="size-4" /> : <Menu className="size-4" />}
        {open ? "Close" : "Menu"}
      </button>
      {open ? (
        <div id={panelId} ref={panelRef} className="absolute inset-x-0 top-full z-20 border-b border-[#1C283C] bg-[#070D18]/95 px-[clamp(1.25rem,5vw,4rem)] py-4 shadow-[0_24px_40px_rgba(0,0,0,.35)] backdrop-blur-md">
          <nav aria-label="Page" className="grid gap-1">
            {items.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-3 text-sm font-semibold uppercase tracking-[.14em] text-[#C5D0E0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22D3EE]">{item.label}</a>
            ))}
          </nav>
          <div className="mt-3 grid gap-2">
            <a href="#account-email" onClick={() => setOpen(false)} className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 text-sm font-semibold text-white">Sign In</a>
            <Link href="/client/register" onClick={() => setOpen(false)} className="kym-action inline-flex min-h-11 items-center justify-center rounded-full text-sm font-semibold text-white">Create Account</Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
