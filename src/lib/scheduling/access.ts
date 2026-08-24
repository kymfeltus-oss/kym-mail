import type { SupabaseClient } from "@supabase/supabase-js";
import { ValidationError } from "@/lib/errors";

export async function requireScheduledIdentity(database: SupabaseClient, ownerId: string, emailAddress: string) {
  const { data, error } = await database.from("mail_accounts")
    .select("id, email_address, mail_connection_id, is_active, send_as_state")
    .eq("owner_id", ownerId)
    .eq("email_address", emailAddress)
    .eq("is_active", true)
    .eq("send_as_state", "available")
    .maybeSingle();
  if (error || !data?.mail_connection_id) throw new ValidationError("The selected sender is not available through Google Mail.");
  return data;
}

export async function resolveScheduledProject(database: SupabaseClient, ownerId: string, requestedProjectId: string | null, providerThreadId?: string) {
  let threadProjectId: string | null = null;
  if (providerThreadId) {
    const { data: thread, error } = await database.from("mail_threads")
      .select("id, project_id")
      .eq("owner_id", ownerId)
      .eq("provider_thread_id", providerThreadId)
      .maybeSingle();
    if (error || !thread) throw new ValidationError("The selected conversation is unavailable.");
    threadProjectId = thread.project_id;
    if (requestedProjectId && threadProjectId && requestedProjectId !== threadProjectId) {
      throw new ValidationError("This conversation already belongs to another Project.");
    }
  }
  const projectId = requestedProjectId ?? threadProjectId;
  if (!projectId) return null;
  const { data: project, error } = await database.from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("owner_id", ownerId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error || !project) throw new ValidationError("Select an active Project or choose None.");
  return project.id;
}
