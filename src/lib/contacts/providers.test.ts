import { describe, expect, it } from "vitest";
import { ConfigurationError } from "@/lib/errors";
import { getContactProviderConfiguration, getContactProviders } from "./providers";

describe("contact provider registry", () => {
  it("preserves the truthful unconfigured state when Apollo is absent", () => {
    expect(getContactProviderConfiguration(getContactProviders({}))).toEqual({ people: null, requirement: "Configure server-only APOLLO_API_KEY with organization enrichment, People API Search, and People Enrichment access." });
  });

  it("registers Apollo only behind the Gate 8 people boundary", () => {
    const providers = getContactProviders({ APOLLO_API_KEY: "apollo-secret-key" });
    expect(providers.people?.key).toBe("apollo");
    expect(getContactProviderConfiguration(providers)).toEqual({ people: "apollo", requirement: null });
  });

  it("rejects an explicitly supplied malformed key", () => {
    expect(() => getContactProviders({ APOLLO_API_KEY: "short" })).toThrow(ConfigurationError);
  });
});
