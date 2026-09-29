import { NextResponse, type NextRequest } from "next/server";
import { buildClientSessionBookingUrl } from "@/lib/clients/booking";
import { getClientContext } from "@/lib/clients/session";
import { clientSessionDurationMinutes } from "@/lib/clients/validation";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const clientContext = await getClientContext();
  if (!clientContext) return NextResponse.json({ error: "Sign in with your client account to book a 15-minute session." }, { status: 401 });
  const { client, database } = clientContext;
  try {
    const { data: settings, error: settingsError } = await database
      .from("consultation_settings")
      .select("client_session_booking_url, client_sessions_active")
      .eq("owner_id", client.owner_id)
      .maybeSingle();
    if (settingsError || !settings?.client_sessions_active || !settings.client_session_booking_url) {
      return NextResponse.json({ error: "15-minute booking is not open yet." }, { status: 503 });
    }
    const { count } = await database.from("client_session_bookings").select("id", { count: "exact", head: true }).eq("client_id", client.id).eq("status", "RELEASED");
    if ((count ?? 0) >= 3) return NextResponse.json({ error: "Finish or cancel an open session before booking another." }, { status: 429 });
    const { data: booking, error } = await database.from("client_session_bookings").insert({
      owner_id: client.owner_id,
      client_id: client.id,
      duration_minutes: clientSessionDurationMinutes,
      status: "RELEASED"
    }).select("id").single();
    if (error || !booking) throw new Error("PUBLIC_SESSION_PERSISTENCE_FAILED");
    return NextResponse.json({
      bookingId: booking.id,
      bookingUrl: buildClientSessionBookingUrl(settings.client_session_booking_url, {
        id: booking.id,
        client_name: client.full_name,
        client_email: client.email
      })
    }, { status: 201 });
  } catch (error) {
    log("error", "consultation.public_session_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    return NextResponse.json({ error: "The 15-minute session could not be opened." }, { status: 503 });
  }
}
