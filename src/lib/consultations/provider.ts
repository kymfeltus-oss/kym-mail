import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ConsultationRequest } from "@/lib/consultations/types";

const supportedTriggers = ["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"] as const;

const calWebhookSchema = z.object({
  triggerEvent: z.enum(supportedTriggers),
  createdAt: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown())
});

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function bookingId(payload: Record<string, unknown>) {
  return stringValue(payload.uid) ?? stringValue(payload.bookingUid) ?? (typeof payload.bookingId === "number" ? String(payload.bookingId) : null);
}

function attendeeEmail(payload: Record<string, unknown>) {
  const attendees = Array.isArray(payload.attendees) ? payload.attendees : [];
  for (const attendee of attendees) {
    if (attendee && typeof attendee === "object") {
      const email = stringValue((attendee as Record<string, unknown>).email);
      if (email) return email.toLowerCase();
    }
  }
  const responses = payload.responses && typeof payload.responses === "object" ? payload.responses as Record<string, unknown> : null;
  const emailResponse = responses?.email;
  if (emailResponse && typeof emailResponse === "object") return stringValue((emailResponse as Record<string, unknown>).value)?.toLowerCase() ?? null;
  return null;
}

function consultationRequestId(payload: Record<string, unknown>) {
  const metadata = payload.metadata && typeof payload.metadata === "object" ? payload.metadata as Record<string, unknown> : null;
  const value = stringValue(metadata?.consultationRequestId);
  return value && z.string().uuid().safeParse(value).success ? value : null;
}

export function verifyCalWebhookSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function parseCalWebhook(rawBody: string) {
  const parsed = calWebhookSchema.parse(JSON.parse(rawBody));
  const payload = parsed.payload;
  const id = bookingId(payload);
  if (!id) throw new Error("CALCOM_BOOKING_ID_MISSING");
  return {
    triggerEvent: parsed.triggerEvent,
    requestId: consultationRequestId(payload),
    bookingId: id,
    eventTypeId: typeof payload.eventTypeId === "number" ? String(payload.eventTypeId) : stringValue(payload.eventTypeId),
    attendeeEmail: attendeeEmail(payload),
    title: stringValue(payload.eventTitle) ?? stringValue(payload.title),
    startTime: stringValue(payload.startTime),
    endTime: stringValue(payload.endTime),
    timezone: stringValue(payload.timeZone) ?? (Array.isArray(payload.attendees) && payload.attendees[0] && typeof payload.attendees[0] === "object" ? stringValue((payload.attendees[0] as Record<string, unknown>).timeZone) : null)
  };
}

export function buildCalBookingUrl(baseUrl: string, request: Pick<ConsultationRequest, "id" | "client_name" | "client_email">) {
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || (url.hostname !== "cal.com" && !url.hostname.endsWith(".cal.com"))) throw new Error("INVALID_CALCOM_URL");
  url.searchParams.set("name", request.client_name);
  url.searchParams.set("email", request.client_email);
  url.searchParams.set("metadata[consultationRequestId]", request.id);
  return url.toString();
}
