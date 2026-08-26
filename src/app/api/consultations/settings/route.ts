import { NextResponse, type NextRequest } from "next/server";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { consultationSettingsSchema } from "@/lib/consultations/validation";
import { consultationOfferings } from "@/lib/consultations/offerings";
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
    consultation_name: consultationOfferings.FIRST_TIME.name,
    duration_minutes: consultationOfferings.FIRST_TIME.durationMinutes,
    price_cents: consultationOfferings.FIRST_TIME.priceCents,
    zelle_recipient_name: input.zelleRecipientName,
    zelle_contact: input.zelleContact,
    payment_instructions: input.paymentInstructions,
    reference_instructions: input.referenceInstructions || null,
    paid_booking_url: input.firstTimeBookingUrl,
    returning_booking_url: input.returningBookingUrl,
    free_booking_url: null,
    scheduling_provider: "CAL_COM",
    is_active: input.isActive
  });
  if (error) return NextResponse.json({ error: "Consultation settings could not be saved." }, { status: 503 });
  return NextResponse.json({ saved: true });
}
