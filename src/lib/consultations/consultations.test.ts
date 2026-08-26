import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalBookingUrl, parseCalWebhook, verifyCalWebhookSignature } from "@/lib/consultations/provider";
import { hasExpectedProofSignature, safeConsultationProofName } from "@/lib/consultations/proof";
import { createConsultationToken, hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";
import { consultationSettingsSchema, consultationSubmissionSchema } from "@/lib/consultations/validation";

describe("consultation security and provider contract", () => {
  it("creates unguessable tokens and persists only deterministic hashes", () => {
    const token = createConsultationToken();
    expect(isConsultationToken(token)).toBe(true);
    expect(hashConsultationToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(createConsultationToken()).not.toBe(token);
  });

  it("validates proof signatures independently of filename and MIME claims", () => {
    expect(hasExpectedProofSignature(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), "image/png")).toBe(true);
    expect(hasExpectedProofSignature(Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]), "image/jpeg")).toBe(true);
    expect(hasExpectedProofSignature(Buffer.from("%PDF-1.7"), "application/pdf")).toBe(true);
    expect(hasExpectedProofSignature(Buffer.from("not a pdf"), "application/pdf")).toBe(false);
    expect(safeConsultationProofName("../payment proof (final).PDF")).toBe("payment-proof-final-.PDF");
  });

  it("restricts settings to Cal.com and does not trust a client-authored consultation type", () => {
    expect(consultationSettingsSchema.safeParse({ consultationName: "Advisory Consultation", durationMinutes: 45, priceDollars: 250, cashAppHandle: "$owner", paymentInstructions: "Pay the exact amount shown.", referenceInstructions: "Use your email.", paidBookingUrl: "https://cal.com/owner/private", freeBookingUrl: "https://cal.com/owner/free", isActive: true }).success).toBe(true);
    expect(consultationSettingsSchema.safeParse({ consultationName: "Advisory Consultation", durationMinutes: 45, priceDollars: 250, cashAppHandle: "$owner", paymentInstructions: "Pay the exact amount shown.", paidBookingUrl: "https://example.com/book", freeBookingUrl: "https://cal.com/owner/free", isActive: true }).success).toBe(false);
    expect(consultationSubmissionSchema.parse({ name: "Test Client", email: "TEST@example.com", consultationType: "Advisory Consultation" }).email).toBe("test@example.com");
  });

  it("prefills Cal.com and carries an exact request ID into signed webhooks", () => {
    const id = randomUUID();
    const bookingUrl = buildCalBookingUrl("https://cal.com/owner/private?overlayCalendar=true", { id, client_name: "Test Client", client_email: "test@example.com" });
    const parsedUrl = new URL(bookingUrl);
    expect(parsedUrl.searchParams.get("name")).toBe("Test Client");
    expect(parsedUrl.searchParams.get("email")).toBe("test@example.com");
    expect(parsedUrl.searchParams.get("metadata[consultationRequestId]")).toBe(id);

    const raw = JSON.stringify({ triggerEvent: "BOOKING_CREATED", createdAt: new Date().toISOString(), payload: { uid: "cal-booking-1", eventTypeId: 42, eventTitle: "Advisory Consultation", startTime: "2026-09-02T15:00:00.000Z", endTime: "2026-09-02T15:45:00.000Z", metadata: { consultationRequestId: id }, attendees: [{ name: "Test Client", email: "TEST@example.com", timeZone: "America/Chicago" }] } });
    const secret = "test-secret-that-is-at-least-thirty-two-characters";
    const signature = createHmac("sha256", secret).update(raw).digest("hex");
    expect(verifyCalWebhookSignature(raw, signature, secret)).toBe(true);
    expect(verifyCalWebhookSignature(`${raw} `, signature, secret)).toBe(false);
    expect(parseCalWebhook(raw)).toMatchObject({ requestId: id, bookingId: "cal-booking-1", attendeeEmail: "test@example.com", timezone: "America/Chicago" });
  });

  it("keeps proof storage private and exposes only owner-select RLS", () => {
    const migration = readFileSync("supabase/migrations/202608260026_calendar_consultations.sql", "utf8");
    expect(migration).toContain("'consultation-payment-proofs'");
    expect(migration).toContain("false,");
    expect(migration).toContain("owners read own consultation requests");
    expect(migration).toContain("grant select on table public.consultation_requests");
    expect(migration).not.toContain("grant insert on table public.consultation_requests to anon");
    expect(migration).toContain("'PAYMENT_SUBMITTED'");
    expect(migration).toContain("'BOOKING_RELEASED'");
    expect(migration).toContain("review_consultation_payment");
  });
});
