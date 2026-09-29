"use server";

import { timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { log } from "@/lib/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SignInState = { message?: string };

const attempts = new Map<string, { count: number; lockedUntil: number }>();

function pinMatches(entered: string, expected: string) {
  const actual = Buffer.from(entered);
  const stored = Buffer.from(expected);
  if (actual.length !== stored.length) return false;
  return timingSafeEqual(actual, stored);
}

async function attemptKey() {
  const requestHeaders = await headers();
  return requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function blocked(key: string) {
  const current = attempts.get(key);
  return Boolean(current && current.lockedUntil > Date.now());
}

function recordFailure(key: string) {
  const current = attempts.get(key);
  const count = current && current.lockedUntil <= Date.now() ? current.count + 1 : 1;
  attempts.set(key, { count, lockedUntil: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
}

async function openOwnerSession() {
  const admin = createSupabaseAdminClient();
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 2 });
  const owner = listed?.users.length === 1 ? listed.users[0] : undefined;
  if (listError || !owner?.email) return false;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) return false;
  const supabase = await createSupabaseServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  return !verifyError;
}

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const key = await attemptKey();
  if (blocked(key)) return { message: "Too many attempts. Wait a few minutes and try again." };
  const expected = process.env.OWNER_ACCESS_PIN?.trim();
  const entered = String(formData.get("pin") ?? "").replace(/\s/g, "");
  if (!expected || !pinMatches(entered, expected)) {
    recordFailure(key);
    log("warn", "auth.pin_rejected");
    return { message: expected ? "That PIN is not correct." : "Owner access is not configured." };
  }
  attempts.delete(key);
  const opened = await openOwnerSession();
  if (!opened) {
    log("error", "auth.pin_session_failed");
    return { message: "The workspace could not be opened. Try again." };
  }
  log("info", "auth.pin_accepted");
  redirect("/app");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  log("info", "auth.sign_out_succeeded");
  redirect("/sign-in");
}
