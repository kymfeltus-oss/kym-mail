import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { buildClientSessionBookingUrl } from "@/lib/clients/booking";
import { publicSessionSchema } from "@/lib/consultations/validation";
import { clientSessionDurationMinutes } from "@/lib/clients/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const database = createSupabaseAdminClient();
  try {
    const form = await request.formData();
    const input = publicSessionSchema.parse({
      name: form.get("name"),
      email: form.get("email"),
      website: form.get("website") ?? ""
    });
    const { data: settingsRows, error: settingsError } = await database
      .from("consultation_settings")
      .select("owner_id, client_session_booking_url, client_sessions_active")
      .eq("client_sessions_active", true)
      .limit(2);
    if (settingsError || settingsRows?.length !== 1 || !settingsRows[0].client_session_booking_url) {
      return NextResponse.json({ error: "15-minute booking is not open yet." }, { status: 503 });
    }
    const settings = settingsRows[0];
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await database.from("client_session_bookings").select("id", { count: "exact", head: true }).eq("guest_email", input.email).gte("created_at", since);
    if ((count ?? 0) >= 3) return NextResponse.json({ error: "Too many recent bookings. Please try again later." }, { status: 429 });
    const { data: booking, error } = await database.from("client_session_bookings").insert({
      owner_id: settings.owner_id,
      client_id: null,
      guest_name: input.name,
      guest_email: input.email,
      duration_minutes: clientSessionDurationMinutes,
      status: "RELEASED"
    }).select("id").single();
    if (error || !booking) throw new Error("PUBLIC_SESSION_PERSISTENCE_FAILED");
    return NextResponse.json({
      bookingId: booking.id,
      bookingUrl: buildClientSessionBookingUrl(settings.client_session_booking_url, {
        id: booking.id,
        client_name: input.name,
        client_email: input.email
      })
    }, { status: 201 });
  } catch (error) {
    log("error", "consultation.public_session_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    const invalid = error instanceof ZodError;
    return NextResponse.json({ error: invalid ? "Check your name and email, then try again." : "The 15-minute session could not be opened." }, { status: invalid ? 400 : 503 });
  }
}
