import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ScheduledMessageEditForm } from "@/components/scheduled-message-edit-form";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "Edit scheduled email" };

export default async function EditScheduledMessagePage({ params }: { params: Promise<{ scheduledId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { scheduledId } = await params;
  const { data: message, error } = await owner.database.from("scheduled_messages").select("id, mail_account_id, project_id, to_addresses, cc_addresses, bcc_addresses, subject, text_body, status, version").eq("id", scheduledId).eq("owner_id", owner.user.id).maybeSingle();
  if (error) throw new Error("SCHEDULED_MAIL_UNAVAILABLE");
  if (!message || message.status !== "SCHEDULED") notFound();
  const [{ data: identities, error: identitiesError }, { data: projects, error: projectsError }, { count: attachmentCount, error: attachmentError }] = await Promise.all([
    owner.database.from("mail_accounts").select("id, email_address, label").eq("owner_id", owner.user.id).eq("is_active", true).eq("send_as_state", "available").order("is_default", { ascending: false }),
    owner.database.from("projects").select("id, name").eq("owner_id", owner.user.id).eq("status", "ACTIVE").order("updated_at", { ascending: false }),
    owner.database.from("scheduled_message_attachments").select("id", { count: "exact", head: true }).eq("scheduled_message_id", message.id).eq("owner_id", owner.user.id)
  ]);
  if (identitiesError || projectsError || attachmentError) throw new Error("SCHEDULED_MAIL_UNAVAILABLE");
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="scheduled"><div className="mx-auto max-w-4xl"><Link href={`/app/scheduled/${message.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#64748B]"><ArrowLeft className="size-4" /> Scheduled email</Link><p className="mt-7 text-xs font-semibold uppercase tracking-[.22em] text-[#D95B72]">Approved delivery snapshot</p><h1 className="mt-2 text-3xl font-semibold tracking-[-.03em] text-[#183A5A] sm:text-4xl">Edit scheduled email</h1><p className="mb-7 mt-3 text-sm leading-6 text-[#64748B]">Changes are accepted only while delivery remains scheduled.</p><ScheduledMessageEditForm message={message} identities={identities ?? []} projects={projects ?? []} attachmentCount={attachmentCount ?? 0} /></div></AppShell>;
}
