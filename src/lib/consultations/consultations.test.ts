import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCalBookingUrl, parseCalWebhook, verifyCalWebhookSignature } from "@/lib/consultations/provider";
import { hasExpectedProofSignature, safeConsultationProofName } from "@/lib/consultations/proof";
import { createConsultationToken, hashConsultationToken, isConsultationToken } from "@/lib/consultations/tokens";
import { consultationSettingsSchema, consultationSubmissionSchema } from "@/lib/consultations/validation";
import { consultationKindForHistory, consultationOfferings } from "@/lib/consultations/offerings";

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

  it("enforces the two fixed paid offerings and Cal.com-only booking settings", () => {
    expect(consultationOfferings.FIRST_TIME).toMatchObject({ durationMinutes: 60, priceCents: 20_000 });
    expect(consultationOfferings.RETURNING).toMatchObject({ durationMinutes: 60, priceCents: 15_000 });
    expect(consultationKindForHistory(false)).toBe("FIRST_TIME");
    expect(consultationKindForHistory(true)).toBe("RETURNING");
    expect(consultationSettingsSchema.safeParse({ cashAppHandle: "$owner", paymentInstructions: "Pay the exact amount shown.", referenceInstructions: "Use your email.", firstTimeBookingUrl: "https://cal.com/owner/first", returningBookingUrl: "https://cal.com/owner/returning", isActive: true }).success).toBe(true);
    expect(consultationSettingsSchema.safeParse({ cashAppHandle: "$owner", paymentInstructions: "Pay the exact amount shown.", firstTimeBookingUrl: "https://example.com/book", returningBookingUrl: "https://cal.com/owner/returning", isActive: true }).success).toBe(false);
    expect(consultationSubmissionSchema.parse({ name: "Test Client", email: "TEST@example.com", consultationKind: "FIRST_TIME" }).email).toBe("test@example.com");
    expect(consultationSubmissionSchema.safeParse({ name: "Test Client", email: "test@example.com", consultationKind: "FREE" }).success).toBe(false);
    expect(existsSync("src/app/api/consultations/free/route.ts")).toBe(false);
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
    const offeringsMigration = readFileSync("supabase/migrations/202608260028_two_paid_consultation_offerings.sql", "utf8");
    expect(offeringsMigration).toContain("consultation_kind in ('FIRST_TIME', 'RETURNING')");
    expect(offeringsMigration).toContain("returning_booking_url");
  });
});
