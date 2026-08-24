import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ProjectForm, type EditableProject, type ProjectIdentity } from "@/components/project-form";
import { getOwnerContext } from "@/lib/auth/owner-context";
import type { ProjectType } from "@/lib/projects/validation";

export const metadata = { title: "Edit Project" };

export default async function EditProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner?.user.email) redirect("/sign-in");
  const { projectId } = await params;
  const [{ data: project, error: projectError }, { data: identities, error: identitiesError }] = await Promise.all([
    owner.database.from("projects").select("id, name, type, objective, status, default_mail_account_id, parameters").eq("id", projectId).eq("owner_id", owner.user.id).maybeSingle(),
    owner.database.from("mail_accounts").select("id, email_address, label, is_default, is_active, send_as_state").eq("owner_id", owner.user.id).order("is_default", { ascending: false })
  ]);
  if (projectError || identitiesError) throw new Error("PROJECT_EDIT_UNAVAILABLE");
  if (!project || project.status === "ARCHIVED") notFound();
  const editable: EditableProject = { id: project.id, name: project.name, type: project.type as ProjectType, objective: project.objective, default_mail_account_id: project.default_mail_account_id, parameters: project.parameters as Record<string, unknown> };
  return <AppShell email={owner.user.email} canSignOut={owner.mode === "authenticated"} active="projects"><ProjectForm identities={(identities ?? []) as ProjectIdentity[]} project={editable} /></AppShell>;
}
