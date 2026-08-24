import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectForm, type ProjectIdentity } from "@/components/project-form";
import { getOwnerContext } from "@/lib/auth/owner-context";

export const metadata = { title: "New Project" };

export default async function NewProjectPage() {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { data: identities, error } = await owner.database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", owner.user.id).order("is_default", { ascending: false });
  if (error) throw new Error("PROJECT_IDENTITIES_UNAVAILABLE");
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="projects"><ProjectForm identities={(identities ?? []) as ProjectIdentity[]} /></AppShell>;
}
