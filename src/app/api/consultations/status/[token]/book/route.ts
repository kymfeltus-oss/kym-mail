import { NextResponse } from "next/server";
import { getReleasedConsultationBooking, recordBookingLinkOpened } from "@/lib/consultations/booking";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const database = createSupabaseAdminClient();
  const released = await getReleasedConsultationBooking(database, token, "STATUS_TOKEN");
  if (!released) return NextResponse.redirect(new URL("/consult?booking=invalid", request.url));
  await recordBookingLinkOpened(database, released.consultation, "STATUS_TOKEN");
  return NextResponse.redirect(released.bookingUrl, { status: 303 });
}
