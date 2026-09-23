import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { createClientNumber } from "@/lib/clients/crypto";
import { ownerClientCreateSchema } from "@/lib/clients/validation";

export async function GET() {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const { data, error } = await owner.database.from("clients").select("id, client_number, full_name, email, phone, is_active, registered_at, created_at").eq("owner_id", owner.user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Clients could not be loaded." }, { status: 503 });
  return NextResponse.json({ clients: data ?? [] });
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const result = ownerClientCreateSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the client details." }, { status: 400 });
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const clientNumber = createClientNumber();
    const { data, error } = await owner.database.from("clients").insert({
      owner_id: owner.user.id,
      client_number: clientNumber,
      full_name: result.data.fullName,
      email: result.data.email,
      phone: result.data.phone || null
    }).select("id, client_number, full_name, email, phone, is_active, registered_at").single();
    if (!error && data) return NextResponse.json({ client: data }, { status: 201 });
    if (error?.code !== "23505") return NextResponse.json({ error: "The client could not be created." }, { status: 503 });
  }
  return NextResponse.json({ error: "A unique client number could not be assigned. Try again." }, { status: 503 });
}
