import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashClientPassword } from "@/lib/clients/crypto";
import { createClientPortalSession } from "@/lib/clients/session";
import { clientRegisterSchema } from "@/lib/clients/validation";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const result = clientRegisterSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the registration details." }, { status: 400 });
  const input = result.data;
  const database = createSupabaseAdminClient();
  const { data: client } = await database
    .from("clients")
    .select("id, registered_at, is_active")
    .eq("email", input.email)
    .eq("client_number", input.clientNumber)
    .maybeSingle();
  if (!client || !client.is_active) return NextResponse.json({ error: "That client number and email do not match an invited client." }, { status: 404 });
  if (client.registered_at) return NextResponse.json({ error: "This client is already registered. Sign in instead." }, { status: 409 });
  const { data: existing } = await database.from("client_credentials").select("client_id").eq("client_id", client.id).maybeSingle();
  if (existing) return NextResponse.json({ error: "This client is already registered. Sign in instead." }, { status: 409 });
  const { error: credentialError } = await database.from("client_credentials").insert({
    client_id: client.id,
    password_hash: await hashClientPassword(input.password)
  });
  if (credentialError) {
    log("error", "client.registration_failed", { code: credentialError.code });
    return NextResponse.json({ error: "Registration could not be completed." }, { status: 503 });
  }
  await database.from("clients").update({ full_name: input.fullName, registered_at: new Date().toISOString() }).eq("id", client.id);
  await createClientPortalSession(database, client.id);
  return NextResponse.json({ registered: true }, { status: 201 });
}
