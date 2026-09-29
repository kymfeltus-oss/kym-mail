import Image from "next/image";

export default function Loading() {
  return <main className="grid min-h-screen place-items-center gap-5">
    <Image src="/brand/kym-mark.png" alt="" width={823} height={200} className="h-10 w-auto" />
    <p role="status" className="text-sm text-[#93A0B5]">Loading KYM Mail…</p>
  </main>;
}
