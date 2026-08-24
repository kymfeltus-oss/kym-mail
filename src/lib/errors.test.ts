import { describe, expect, it } from "vitest";
import { toSafeError, ValidationError } from "./errors";
describe("safe errors", () => {
  it("preserves safe domain messages", () => expect(toSafeError(new ValidationError("Invalid field."))).toEqual({ code: "VALIDATION", safeMessage: "Invalid field." }));
  it("does not leak unknown errors", () => expect(toSafeError(new Error("database password"))).toEqual({ code: "INTERNAL", safeMessage: "Something went wrong. Please try again." }));
});
