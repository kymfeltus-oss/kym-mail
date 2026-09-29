import Image from "next/image";
import Link from "next/link";

export function BrandLockup({ href = "/", priority = false, className = "h-12 w-auto object-contain" }: { href?: string; priority?: boolean; className?: string }) {
  const image = <Image src="/brand/kym-mail-lockup.png" alt="KYM Mail" width={823} height={288} priority={priority} className={className} />;
  if (!href) return image;
  return <Link href={href} className="inline-flex items-center">{image}</Link>;
}
