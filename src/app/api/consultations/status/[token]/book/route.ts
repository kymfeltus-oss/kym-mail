import { NextResponse } from "next/server";
import { buildCalBookingUrl } from "@/lib/consultations/provider";
import { hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isConsultationToken(token)) return NextResponse.redirect(new URL("/consult?booking=invalid", request.url));
  const database = createSupabaseAdminClient();
  const { data: consultation } = await database.from("consultation_requests").select("id, owner_id, client_name, client_email, payment_status, booking_token_expires_at, provider_booking_id").eq("status_token_hash", hashConsultationToken(token)).maybeSingle();
  const usable = consultation && ["PAYMENT_APPROVED", "BOOKING_RELEASED"].includes(consultation.payment_status) && !consultation.provider_booking_id && consultation.booking_token_expires_at && new Date(consultation.booking_token_expires_at).getTime() > Date.now();
  if (!usable) return NextResponse.redirect(new URL("/consult?booking=invalid", request.url));
  const { data: settings } = await database.from("consultation_settings").select("paid_booking_url").eq("owner_id", consultation.owner_id).eq("is_active", true).maybeSingle();
  if (!settings) return NextResponse.redirect(new URL("/consult?booking=unavailable", request.url));
  await database.from("consultation_events").insert({ owner_id: consultation.owner_id, consultation_request_id: consultation.id, event_type: "BOOKING_LINK_OPENED", actor_type: "CLIENT", details: { access: "STATUS_TOKEN" } });
  return NextResponse.redirect(buildCalBookingUrl(settings.paid_booking_url, consultation), { status: 303 });
}
