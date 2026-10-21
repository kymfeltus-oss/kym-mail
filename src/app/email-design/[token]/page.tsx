import { notFound } from "next/navigation";
import { findEmailDesignShareByToken } from "@/lib/mail/email-design-share";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Email design · KYM Mail",
  robots: { index: false, follow: false }
};

export default async function EmailDesignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await findEmailDesignShareByToken(createSupabaseAdminClient(), token);
  if (!share) notFound();

  return <main className="min-h-screen bg-[#05070D] px-4 py-10 text-[#F4F7FB] sm:px-8">
    <div className="mx-auto max-w-[624px]">
      <p className="text-center text-[10px] font-semibold uppercase tracking-[.28em] text-[#22D3EE]">KYM Mail · Full design</p>
      <h1 className="mt-3 text-center text-xl font-semibold">{share.subject}</h1>
      <p className="mt-2 text-center text-xs text-[#93A0B5]">From {share.from_address}</p>
      <img
        src={`/api/email-design/${encodeURIComponent(token)}/image`}
        alt={`Full email design: ${share.subject}. The message text is available below.`}
        width={624}
        className="mt-6 block h-auto w-full rounded border border-[#1C283C]"
      />
      <details className="mt-6 rounded-2xl border border-[#1C283C] bg-[#101828] p-5">
        <summary className="cursor-pointer text-sm font-semibold text-[#67E8F9]">Read the accessible text version</summary>
        <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-[#D9E1EC]">{share.text_body}</pre>
      </details>
      <p className="mt-6 text-center text-xs text-[#66758A]">This private link expires {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(share.expires_at))}.</p>
    </div>
  </main>;
}
