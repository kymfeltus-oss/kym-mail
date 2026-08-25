import Image from "next/image";

export function JobsAttribution({ compact = false }: { compact?: boolean }) {
  return <a href="https://www.adzuna.com/" target="_blank" rel="noopener noreferrer" aria-label="Jobs by Adzuna" className={`inline-flex min-h-[23px] min-w-[116px] items-center gap-1.5 font-semibold text-[#64748B] ${compact ? "text-[11px]" : "text-xs"}`}>Jobs by <Image src="/adzuna-logo.svg" alt="Adzuna" width={170} height={45} className="h-[23px] w-[87px]" /></a>;
}
