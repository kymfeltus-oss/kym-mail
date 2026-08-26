import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const database = createSupabaseAdminClient();
  const { data } = await database.from("consultation_settings").select("free_booking_url").eq("is_active", true).limit(1).maybeSingle();
  if (!data?.free_booking_url) return NextResponse.redirect(new URL("/consult?booking=unavailable", process.env.APP_URL ?? "http://localhost:3000"));
  return NextResponse.redirect(data.free_booking_url, { status: 303 });
}
