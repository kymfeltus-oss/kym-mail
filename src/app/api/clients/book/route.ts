import { NextResponse, type NextRequest } from "next/server";
import { buildClientSessionBookingUrl } from "@/lib/clients/booking";
import { getClientContext } from "@/lib/clients/session";
import { clientBookingSchema, clientSessionDurationMinutes } from "@/lib/clients/validation";
import { normalizeClientNumber } from "@/lib/clients/crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const clientContext = await getClientContext();
  if (!clientContext) return NextResponse.json({ error: "Please sign in to book a session." }, { status: 401 });
  const result = clientBookingSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Enter your client number." }, { status: 400 });
  if (normalizeClientNumber(result.data.clientNumber) !== clientContext.client.client_number) {
    return NextResponse.json({ error: "That client number does not match this account." }, { status: 403 });
  }
  const { client, database } = clientContext;
  const { data: settings } = await database
    .from("consultation_settings")
    .select("client_session_booking_url, client_sessions_active")
    .eq("owner_id", client.owner_id)
    .maybeSingle();
  if (!settings?.client_sessions_active || !settings.client_session_booking_url) {
    return NextResponse.json({ error: "15-minute client sessions are not open yet." }, { status: 503 });
  }
  const { count } = await database.from("client_session_bookings").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "RELEASED");
  if ((count ?? 0) >= 3) return NextResponse.json({ error: "Finish or cancel an open session before booking another." }, { status: 429 });
  const { data: booking, error } = await database.from("client_session_bookings").insert({
    owner_id: client.owner_id,
    client_id: client.id,
    duration_minutes: clientSessionDurationMinutes,
    status: "RELEASED"
  }).select("id").single();
  if (error || !booking) return NextResponse.json({ error: "The session could not be started." }, { status: 503 });
  return NextResponse.json({
    bookingId: booking.id,
    bookingUrl: buildClientSessionBookingUrl(settings.client_session_booking_url, {
      id: booking.id,
      client_name: client.full_name,
      client_email: client.email
    })
  }, { status: 201 });
}
