import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { getDevAuthEnv, getPublicEnv, isDevAuthBypassEnabled } from "@/lib/env";
import { ConfigurationError } from "@/lib/errors";
import { log } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OwnerContext = {
  mode: "authenticated" | "development-bypass";
  user: User;
  database: SupabaseClient;
};

async function getDevelopmentOwnerContext(): Promise<OwnerContext> {
  const publicEnv = getPublicEnv();
  const devEnv = getDevAuthEnv();
  const database = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, devEnv.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { data, error } = await database.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new ConfigurationError("Development owner could not be resolved.");
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === devEnv.KYM_DEV_OWNER_EMAIL.toLowerCase());
  if (!user) throw new ConfigurationError("Development owner does not exist.");
  log("warn", "auth.development_bypass_active");
  return { mode: "development-bypass", user, database };
}

export async function getOwnerContext(): Promise<OwnerContext | null> {
  if (isDevAuthBypassEnabled()) return getDevelopmentOwnerContext();
  const database = await createSupabaseServerClient();
  const { data: { user } } = await database.auth.getUser();
  return user ? { mode: "authenticated", user, database } : null;
}
