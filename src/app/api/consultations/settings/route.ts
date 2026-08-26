import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { consultationSettingsSchema } from "@/lib/consultations/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function PUT(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const result = consultationSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return NextResponse.json({ error: result.error.issues[0]?.message ?? "Check the consultation settings." }, { status: 400 });
  const input = result.data;
  const database = createSupabaseAdminClient();
  const { error } = await database.from("consultation_settings").upsert({
    owner_id: owner.user.id,
    consultation_name: input.consultationName,
    duration_minutes: input.durationMinutes,
    price_cents: Math.round(input.priceDollars * 100),
    cash_app_handle: input.cashAppHandle,
    payment_instructions: input.paymentInstructions,
    reference_instructions: input.referenceInstructions || null,
    paid_booking_url: input.paidBookingUrl,
    free_booking_url: input.freeBookingUrl,
    scheduling_provider: "CAL_COM",
    is_active: input.isActive
  });
  if (error) return NextResponse.json({ error: "Consultation settings could not be saved." }, { status: 503 });
  return NextResponse.json({ saved: true });
}
