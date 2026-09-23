import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createClientSessionToken } from "@/lib/clients/crypto";
import { clientSessionCookie, clientSessionTtlMs, type ClientRecord } from "@/lib/clients/types";

export function hashClientSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createClientPortalSession(database: SupabaseClient, clientId: string) {
  const token = createClientSessionToken();
  const expiresAt = new Date(Date.now() + clientSessionTtlMs).toISOString();
  await database.from("client_sessions").insert({
    client_id: clientId,
    token_hash: hashClientSessionToken(token),
    expires_at: expiresAt
  });
  const store = await cookies();
  store.set(clientSessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(clientSessionTtlMs / 1000)
  });
}

export async function clearClientPortalSession() {
  const store = await cookies();
  const token = store.get(clientSessionCookie)?.value;
  const database = createSupabaseAdminClient();
  if (token) await database.from("client_sessions").delete().eq("token_hash", hashClientSessionToken(token));
  store.set(clientSessionCookie, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function getClientContext(): Promise<{ client: ClientRecord; database: SupabaseClient } | null> {
  const store = await cookies();
  const token = store.get(clientSessionCookie)?.value;
  if (!token) return null;
  const database = createSupabaseAdminClient();
  const { data: session } = await database
    .from("client_sessions")
    .select("client_id, expires_at")
    .eq("token_hash", hashClientSessionToken(token))
    .maybeSingle();
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) return null;
  const { data: client } = await database
    .from("clients")
    .select("id, owner_id, client_number, full_name, email, phone, is_active, registered_at")
    .eq("id", session.client_id)
    .eq("is_active", true)
    .maybeSingle();
  return client ? { client: client as ClientRecord, database } : null;
}
