import { z } from "zod";
import { ConfigurationError } from "@/lib/errors";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20)
});

const devAuthEnvSchema = z.object({
  KYM_DEV_OWNER_EMAIL: z.string().trim().email(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20)
});

const supabaseAdminEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20)
});

const schedulerEnvSchema = z.object({
  CRON_SECRET: z.string().min(32)
});

const googleMailEnvSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(10),
  GOOGLE_CLIENT_SECRET: z.string().min(10),
  GOOGLE_REDIRECT_URI: z.string().url(),
  GOOGLE_CLOUD_PROJECT_ID: z.string().min(3),
  GMAIL_PUBSUB_TOPIC: z.string().startsWith("projects/"),
  GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT: z.string().trim().email(),
  GMAIL_PUBSUB_AUDIENCE: z.string().url(),
  OAUTH_STATE_SECRET: z.string().min(24),
  MAIL_TOKEN_ENCRYPTION_KEY: z.string().min(40),
  APP_URL: z.string().url()
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parsePublicEnv(input: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError("Authentication is not configured.", { issues: result.error.issues.map(({ path, code }) => ({ path, code })) });
  return result.data;
}

export function getPublicEnv(): PublicEnv {
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function isDevAuthBypassEnabled(input: Record<string, string | undefined> = process.env): boolean {
  return input.NODE_ENV !== "production" && input.KYM_DEV_AUTH_BYPASS === "true";
}

export function getDevAuthEnv(input: Record<string, string | undefined> = process.env) {
  const result = devAuthEnvSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError("Development authentication bypass is not configured.");
  return result.data;
}

export function getSupabaseAdminEnv(input: Record<string, string | undefined> = process.env) {
  const result = supabaseAdminEnvSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError("Server database access is not configured.");
  return result.data;
}

export function getSchedulerEnv(input: Record<string, string | undefined> = process.env) {
  const result = schedulerEnvSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError("Scheduled delivery is not configured.");
  return result.data;
}

export function getGoogleMailEnv(input: Record<string, string | undefined> = process.env) {
  const result = googleMailEnvSchema.safeParse(input);
  if (!result.success) throw new ConfigurationError("Google Mail is not configured.");
  return result.data;
}
