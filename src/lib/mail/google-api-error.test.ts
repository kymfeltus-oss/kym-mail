import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { googleMailFailure, isRecoverableGmailHistoryError } from "./google-api-error";

describe("Google Mail API error classification", () => {
  it("treats quota errors as busy instead of a dropped connection", () => {
    expect(googleMailFailure(429).exhausted).toBe(true);
    expect(googleMailFailure(403, "RESOURCE_EXHAUSTED").exhausted).toBe(true);
    expect(googleMailFailure(429).safeMessage).toContain("busy");
  });

  it("treats expired history cursors as recoverable", () => {
    expect(googleMailFailure(404).staleHistory).toBe(true);
    expect(googleMailFailure(400, "FAILED_PRECONDITION").staleHistory).toBe(true);
    expect(isRecoverableGmailHistoryError(new AppError("PROVIDER_UNAVAILABLE", "Google Mail is temporarily unavailable.", { status: 404 }))).toBe(true);
    expect(isRecoverableGmailHistoryError(new AppError("PROVIDER_UNAVAILABLE", "Google Mail is temporarily unavailable.", { status: 403, providerStatus: "PERMISSION_DENIED", path: "/history" }))).toBe(true);
  });

  it("asks for reconnect when Gmail refuses access", () => {
    expect(googleMailFailure(403, "PERMISSION_DENIED").forbidden).toBe(true);
    expect(googleMailFailure(403, "PERMISSION_DENIED").safeMessage).toContain("Reconnect");
  });
});
