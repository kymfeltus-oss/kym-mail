import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@/lib/errors";
import { getContactProviderConfiguration, getContactProviders } from "./providers";

describe("contact provider registry", () => {
  it("preserves the truthful unconfigured state when Apollo is absent", () => {
    expect(getContactProviderConfiguration(getContactProviders({}))).toEqual({ people: null, email: null, verification: null });
  });

  it("registers one shared Apollo adapter for people and business email", () => {
    const providers = getContactProviders({ APOLLO_API_KEY: "apollo-secret-key" });
    expect(providers.people?.key).toBe("apollo");
    expect(providers.email?.key).toBe("apollo");
    expect(providers.email).toBe(providers.people);
    expect(providers.verification).toBeNull();
  });

  it("rejects an explicitly supplied malformed key", () => {
    expect(() => getContactProviders({ APOLLO_API_KEY: "short" })).toThrow(ConfigurationError);
  });
});
