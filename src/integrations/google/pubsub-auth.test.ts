import { describe, expect, it } from "vitest";
import { getBearerToken, hasExpectedPubSubClaims } from "./pubsub-auth";

describe("Google Pub/Sub bearer authentication", () => {
  it("extracts only a well-formed bearer token", () => {
    expect(getBearerToken("Bearer signed-token")).toBe("signed-token");
    expect(getBearerToken("Basic signed-token")).toBeNull();
    expect(getBearerToken(null)).toBeNull();
  });

  it("requires the expected verified service account, audience, and Google issuer", () => {
    const expected = {
      aud: "https://www.kymmailapp.com/api/webhooks/gmail",
      email: "kym-mail-pubsub-push@kym-mail.iam.gserviceaccount.com",
      email_verified: true,
      iss: "https://accounts.google.com",
      sub: "service-account-subject",
      iat: 1_700_000_000,
      exp: 1_700_003_600
    };
    expect(hasExpectedPubSubClaims(expected, expected.email, expected.aud)).toBe(true);
    expect(hasExpectedPubSubClaims({ ...expected, aud: "https://attacker.example" }, expected.email, expected.aud)).toBe(false);
    expect(hasExpectedPubSubClaims({ ...expected, email_verified: false }, expected.email, expected.aud)).toBe(false);
  });
});
