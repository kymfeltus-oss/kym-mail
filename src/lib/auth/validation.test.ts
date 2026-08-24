import { describe, expect, it } from "vitest";
import { signInSchema } from "./validation";
describe("signInSchema", () => {
  it("accepts a normalized valid credential shape", () => expect(signInSchema.parse({ email: " owner@example.com ", password: "strongpass" }).email).toBe("owner@example.com"));
  it("rejects malformed email and short passwords", () => expect(signInSchema.safeParse({ email: "nope", password: "short" }).success).toBe(false));
});
