"use server";

import { redirect } from "next/navigation";
import { signInSchema } from "@/lib/auth/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/logger";

export type SignInState = { message?: string; fields?: { email?: string } };

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = signInSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { message: parsed.error.issues[0]?.message ?? "Check your details.", fields: { email: String(formData.get("email") ?? "") } };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) { log("warn", "auth.sign_in_failed", { reason: error.code }); return { message: "Email or password is incorrect.", fields: { email: parsed.data.email } }; }
  log("info", "auth.sign_in_succeeded");
  redirect("/app");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  log("info", "auth.sign_out_succeeded");
  redirect("/sign-in");
}
