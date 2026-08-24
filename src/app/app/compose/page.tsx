import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ComposeForm } from "@/components/compose-form";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Compose" };

export default async function ComposePage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const [{ data: identities, error: identityError }, { data: projects, error: projectError }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address, label, is_default").eq("owner_id", owner.user.id).eq("is_active", true).eq("send_as_state", "available").order("is_default", { ascending: false }),
    owner.database.from("projects").select("id, name, default_mail_account_id").eq("owner_id", owner.user.id).eq("status", "ACTIVE").order("updated_at", { ascending: false })
  ]);
  if (identityError || projectError) throw new Error("COMPOSE_CONTEXT_UNAVAILABLE");
  const requestedProjectId = (await searchParams).project ?? "";
  const initialProjectId = (projects ?? []).some((project) => project.id === requestedProjectId) ? requestedProjectId : "";
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="compose">
    <div className="mx-auto max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">New message</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">Compose</h1>
      <p className="mb-7 mt-3 text-sm leading-6 text-[#64748B]">Send through your verified KYM Mail identity.</p>
      {identities?.length ? <ComposeForm identities={identities} projects={projects ?? []} initialProjectId={initialProjectId} /> : <div className="glass rounded-3xl p-8"><p className="text-sm text-[#64748B]">Connect Google Mail and verify a sender identity before composing.</p></div>}
    </div>
  </AppShell>;
}
