import { buildCalBookingUrl } from "@/lib/consultations/provider";

export function buildClientSessionBookingUrl(baseUrl: string, booking: { id: string; client_name: string; client_email: string }) {
  const url = new URL(buildCalBookingUrl(baseUrl, { id: booking.id, client_name: booking.client_name, client_email: booking.client_email }));
  url.searchParams.delete("metadata[consultationRequestId]");
  url.searchParams.set("metadata[clientSessionBookingId]", booking.id);
  return url.toString();
}
