import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildClientSessionBookingUrl } from "@/lib/clients/booking";
import { createClientNumber, isClientNumber, normalizeClientNumber, hashClientPassword, verifyClientPassword } from "@/lib/clients/crypto";
import { clientRegisterSchema, clientBookingSchema, clientSessionDurationMinutes } from "@/lib/clients/validation";
import { parseCalWebhook } from "@/lib/consultations/provider";

describe("paying client portal", () => {
  it("issues KYM client numbers and verifies passwords", async () => {
    const number = createClientNumber();
    expect(isClientNumber(number)).toBe(true);
    expect(normalizeClientNumber(" kym-000111 ")).toBe("KYM-000111");
    const hash = await hashClientPassword("correct-horse");
    expect(await verifyClientPassword("correct-horse", hash)).toBe(true);
    expect(await verifyClientPassword("wrong-password", hash)).toBe(false);
  });

  it("requires a matching client number and keeps sessions at 15 minutes", () => {
    expect(clientSessionDurationMinutes).toBe(15);
    expect(clientRegisterSchema.safeParse({ fullName: "Ada Client", email: "ada@example.com", clientNumber: "KYM-123456", password: "longenough" }).success).toBe(true);
    expect(clientBookingSchema.safeParse({ clientNumber: "KYM-99" }).success).toBe(false);
    expect(existsSync("src/app/api/consultations/free/route.ts")).toBe(false);
    expect(existsSync("src/app/client/page.tsx")).toBe(true);
    expect(readFileSync("src/app/consult/page.tsx", "utf8")).toContain("Book a 15-minute session.");
  });

  it("sends client session metadata to Cal.com instead of a paid consultation request id", () => {
    const id = randomUUID();
    const url = new URL(buildClientSessionBookingUrl("https://cal.com/owner/fifteen", { id, client_name: "Ada Client", client_email: "ada@example.com" }));
    expect(url.searchParams.get("metadata[clientSessionBookingId]")).toBe(id);
    expect(url.searchParams.get("metadata[consultationRequestId]")).toBeNull();
    const raw = JSON.stringify({ triggerEvent: "BOOKING_CREATED", payload: { uid: "cal-15", metadata: { clientSessionBookingId: id }, attendees: [{ email: "ADA@example.com", timeZone: "America/New_York" }], startTime: "2026-09-16T15:00:00.000Z", endTime: "2026-09-16T15:15:00.000Z" } });
    expect(parseCalWebhook(raw)).toMatchObject({ clientSessionBookingId: id, requestId: null, attendeeEmail: "ada@example.com" });
  });
});
