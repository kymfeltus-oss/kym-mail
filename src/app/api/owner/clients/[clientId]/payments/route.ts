import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { ownerPaymentSchema } from "@/lib/clients/validation";

export async function POST(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { clientId } = await params;
  if (!z.string().uuid().safeParse(clientId).success) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const result = ownerPaymentSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the payment details." }, { status: 400 });
  const { data: client } = await owner.database.from("clients").select("id").eq("id", clientId).eq("owner_id", owner.user.id).maybeSingle();
  if (!client) return NextResponse.json({ error: "Client not found." }, { status: 404 });
  const { data, error } = await owner.database.from("client_payments").insert({
    owner_id: owner.user.id,
    client_id: clientId,
    amount_cents: result.data.amountCents,
    status: result.data.status,
    note: result.data.note || null
  }).select("id, amount_cents, status, note, occurred_at").single();
  if (error || !data) return NextResponse.json({ error: "The payment could not be recorded." }, { status: 503 });
  return NextResponse.json({ payment: data }, { status: 201 });
}
