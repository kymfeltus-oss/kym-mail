import { describe, expect, it } from "vitest";
import { isValidTimeZone, validateScheduleTiming } from "./validation";

describe("scheduled delivery timing", () => {
  const now = new Date("2026-08-24T12:00:00.000Z");

  it("keeps an unambiguous future instant and authoritative IANA timezone", () => {
    expect(validateScheduleTiming({ scheduledFor: "2026-08-24T13:15:00.000Z", timezone: "America/Chicago" }, now)).toEqual({
      scheduledFor: "2026-08-24T13:15:00.000Z",
      timezone: "America/Chicago"
    });
  });

  it("rejects past, malformed, and unknown timezone input", () => {
    expect(validateScheduleTiming({ scheduledFor: "2026-08-24T11:59:59.000Z", timezone: "America/Chicago" }, now)).toBeNull();
    expect(validateScheduleTiming({ scheduledFor: "tomorrow", timezone: "America/Chicago" }, now)).toBeNull();
    expect(validateScheduleTiming({ scheduledFor: "2026-08-24T13:00:00.000Z", timezone: "Mars/Olympus" }, now)).toBeNull();
  });

  it("accepts DST boundary instants because the canonical timestamp includes an offset", () => {
    expect(validateScheduleTiming({ scheduledFor: "2026-11-01T07:30:00.000Z", timezone: "America/Chicago" }, now)?.scheduledFor).toBe("2026-11-01T07:30:00.000Z");
    expect(isValidTimeZone("America/Chicago")).toBe(true);
  });
});
