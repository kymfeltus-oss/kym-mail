import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyClientPassword } from "@/lib/clients/crypto";
import { createClientPortalSession } from "@/lib/clients/session";
import { clientSignInSchema } from "@/lib/clients/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const result = clientSignInSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check your sign-in details." }, { status: 400 });
  const database = createSupabaseAdminClient();
  const { data: client } = await database.from("clients").select("id, is_active").eq("email", result.data.email).maybeSingle();
  if (!client || !client.is_active) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  const { data: credentials } = await database.from("client_credentials").select("password_hash").eq("client_id", client.id).maybeSingle();
  if (!credentials || !(await verifyClientPassword(result.data.password, credentials.password_hash))) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  await createClientPortalSession(database, client.id);
  return NextResponse.json({ signedIn: true });
}
