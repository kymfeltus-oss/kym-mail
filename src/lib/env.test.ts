import { describe, expect, it } from "vitest";
import { getContactProviderEnv, getJobSearchEnv, getSchedulerEnv, hasContactProviderEnv, isDevAuthBypassEnabled, parsePublicEnv } from "./env";
import { ConfigurationError } from "./errors";
describe("environment validation", () => {
  it("accepts complete public configuration", () => expect(parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(20) }).NEXT_PUBLIC_SUPABASE_URL).toContain("supabase.co"));
  it("fails safely when configuration is missing", () => expect(() => parsePublicEnv({})).toThrow(ConfigurationError));
});
describe("development authentication bypass", () => {
  it("is enabled only when explicitly true outside production", () => expect(isDevAuthBypassEnabled({ NODE_ENV: "development", KYM_DEV_AUTH_BYPASS: "true" })).toBe(true));
  it("is disabled by default", () => expect(isDevAuthBypassEnabled({ NODE_ENV: "development" })).toBe(false));
  it("is forcibly disabled in production", () => expect(isDevAuthBypassEnabled({ NODE_ENV: "production", KYM_DEV_AUTH_BYPASS: "true" })).toBe(false));
});
describe("scheduler environment", () => {
  it("requires a server-only high-entropy cron secret", () => {
    expect(getSchedulerEnv({ CRON_SECRET: "s".repeat(32) }).CRON_SECRET).toHaveLength(32);
    expect(() => getSchedulerEnv({ CRON_SECRET: "short" })).toThrow(ConfigurationError);
  });
});
describe("Job Search environment", () => {
  it("requires server-only Adzuna credentials", () => {
    expect(getJobSearchEnv({ ADZUNA_APP_ID: "app-id", ADZUNA_APP_KEY: "secret-key" }).ADZUNA_APP_ID).toBe("app-id");
    expect(() => getJobSearchEnv({})).toThrow(ConfigurationError);
  });
});
describe("contact-provider environment", () => {
  it("requires a server-only Apollo API key", () => {
    expect(getContactProviderEnv({ APOLLO_API_KEY: "apollo-secret-key" }).APOLLO_API_KEY).toBe("apollo-secret-key");
    expect(() => getContactProviderEnv({ APOLLO_API_KEY: "short" })).toThrow(ConfigurationError);
  });

  it("distinguishes missing configuration from an explicitly supplied key", () => {
    expect(hasContactProviderEnv({})).toBe(false);
    expect(hasContactProviderEnv({ APOLLO_API_KEY: "apollo-secret-key" })).toBe(true);
  });
});
