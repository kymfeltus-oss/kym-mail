import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { ownerClientUpdateSchema } from "@/lib/clients/validation";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { clientId } = await params;
  if (!z.string().uuid().safeParse(clientId).success) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const result = ownerClientUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the client details." }, { status: 400 });
  const { data, error } = await owner.database.from("clients").update({
    full_name: result.data.fullName,
    email: result.data.email,
    phone: result.data.phone || null,
    is_active: result.data.isActive
  }).eq("id", clientId).eq("owner_id", owner.user.id).select("id, client_number, full_name, email, phone, is_active, registered_at").maybeSingle();
  if (error) return NextResponse.json({ error: "The client could not be updated." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  return NextResponse.json({ client: data });
}
