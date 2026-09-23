import type { SupabaseClient } from "@supabase/supabase-js";
import { buildCalBookingUrl } from "@/lib/consultations/provider";
import type { ConsultationKind } from "@/lib/consultations/offerings";
import { hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";

export type BookingAccess = "BOOKING_TOKEN" | "STATUS_TOKEN";

export async function getReleasedConsultationBooking(
  database: SupabaseClient,
  token: string,
  access: BookingAccess
) {
  if (!isConsultationToken(token)) return null;
  const column = access === "STATUS_TOKEN" ? "status_token_hash" : "booking_token_hash";
  const { data: consultation } = await database
    .from("consultation_requests")
    .select("id, owner_id, client_name, client_email, consultation_kind, consultation_type, payment_status, booking_token_expires_at, provider_booking_id")
    .eq(column, hashConsultationToken(token))
    .maybeSingle();
  const usable = consultation
    && ["PAYMENT_APPROVED", "BOOKING_RELEASED"].includes(consultation.payment_status)
    && !consultation.provider_booking_id
    && consultation.booking_token_expires_at
    && new Date(consultation.booking_token_expires_at).getTime() > Date.now();
  if (!usable) return null;
  const { data: settings } = await database
    .from("consultation_settings")
    .select("paid_booking_url, returning_booking_url")
    .eq("owner_id", consultation.owner_id)
    .eq("is_active", true)
    .maybeSingle();
  const bookingUrl = (consultation.consultation_kind as ConsultationKind) === "RETURNING"
    ? settings?.returning_booking_url
    : settings?.paid_booking_url;
  if (!bookingUrl) return null;
  return { consultation, bookingUrl: buildCalBookingUrl(bookingUrl, consultation) };
}

export async function recordBookingLinkOpened(
  database: SupabaseClient,
  consultation: { id: string; owner_id: string },
  access: BookingAccess
) {
  await database.from("consultation_events").insert({
    owner_id: consultation.owner_id,
    consultation_request_id: consultation.id,
    event_type: "BOOKING_LINK_OPENED",
    actor_type: "CLIENT",
    details: { access }
  });
}

export function withCalEmbed(bookingUrl: string) {
  const url = new URL(bookingUrl);
  url.searchParams.set("embed", "true");
  return url.toString();
}
