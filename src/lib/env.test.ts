import { describe, expect, it } from "vitest";
import { isDevAuthBypassEnabled, parsePublicEnv } from "./env";
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
