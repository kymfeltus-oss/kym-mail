import { redirect } from "next/navigation";
import Link from "next/link";
import { ClientChrome } from "@/components/clients/client-chrome";
import { ClientBookingForm } from "@/components/clients/client-booking-form";
import { ClientSignOutButton } from "@/components/clients/client-sign-out-button";
import { getClientContext } from "@/lib/clients/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book a 15-minute session" };

export default async function ClientBookPage() {
  const context = await getClientContext();
  if (!context) redirect("/client/sign-in");
  const { data: settings } = await context.database.from("consultation_settings").select("client_sessions_active, client_session_booking_url").eq("owner_id", context.client.owner_id).maybeSingle();
  const open = Boolean(settings?.client_sessions_active && settings.client_session_booking_url);
  return (
    <ClientChrome action={<><Link href="/client">Dashboard</Link><ClientSignOutButton /></>}>
      <section className="mx-auto mt-12 max-w-xl">
        <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Existing-client session</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-.04em] text-[#183A5A]">Book 15 minutes.</h1>
        <p className="mt-4 text-sm leading-6 text-[#5E6C7D]">This meeting is only for paying clients. Confirm client number {context.client.client_number} to continue.</p>
        <div className="mt-8">{open ? <ClientBookingForm clientNumber={context.client.client_number} /> : <div className="rounded-3xl border border-[#E8E2E3] bg-white p-8"><h2 className="text-xl font-semibold text-[#183A5A]">Booking is not open yet.</h2><p className="mt-3 text-sm leading-6 text-[#64748B]">The owner still needs to save the 15-minute Cal.com link and turn on client sessions.</p><Link href="/client" className="mt-6 inline-flex text-sm font-semibold text-[#A73D52]">Return to dashboard</Link></div>}</div>
      </section>
    </ClientChrome>
  );
}
