import { describe, expect, it } from "vitest";
import { AppError, UnauthorizedError } from "@/lib/errors";
import { scheduledFailureDecision } from "@/lib/scheduling/executor";

describe("scheduled delivery failure decisions", () => {
  it("retries a transient provider failure below the attempt limit", () => {
    const decision = scheduledFailureDecision(
      new AppError("PROVIDER_UNAVAILABLE", "Google Mail is temporarily unavailable.", { status: 503 }),
      1,
      3
    );
    expect(decision).toEqual({
      retry: true,
      code: "PROVIDER_UNAVAILABLE",
      message: "Delivery was temporarily unavailable and will be retried."
    });
  });

  it("does not retry a permanent provider rejection", () => {
    const decision = scheduledFailureDecision(
      new AppError("PROVIDER_UNAVAILABLE", "Google rejected this message.", { status: 400 }),
      1,
      3
    );
    expect(decision.retry).toBe(false);
    expect(decision.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("stops retrying when the maximum attempt is reached", () => {
    const decision = scheduledFailureDecision(
      new AppError("PROVIDER_UNAVAILABLE", "Google Mail is temporarily unavailable.", { status: 503 }),
      3,
      3
    );
    expect(decision.retry).toBe(false);
  });

  it("requires Google reauthorization without retrying", () => {
    const decision = scheduledFailureDecision(new UnauthorizedError("Google Mail authorization expired."), 1, 3);
    expect(decision).toEqual({
      retry: false,
      code: "REAUTHORIZATION_REQUIRED",
      message: "Reconnect Google Mail before retrying this delivery."
    });
  });
});
