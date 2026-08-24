import { createClient } from "@supabase/supabase-js";
import { getPublicEnv, getSupabaseAdminEnv } from "@/lib/env";

export function createSupabaseAdminClient() {
  const publicEnv = getPublicEnv();
  const serverEnv = getSupabaseAdminEnv();
  return createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, serverEnv.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
}
