import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { consultationReviewSchema } from "@/lib/consultations/validation";
import { createConsultationToken, hashConsultationToken } from "@/lib/consultations/tokens";
import { sendConsultationNotification } from "@/lib/consultations/notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const { requestId } = await params;
  if (!z.string().uuid().safeParse(requestId).success) return NextResponse.json({ error: "Consultation request not found." }, { status: 404 });
  const decision = consultationReviewSchema.safeParse(await request.json().catch(() => null));
  if (!decision.success) return NextResponse.json({ error: decision.error.issues[0]?.message ?? "Choose approve or reject." }, { status: 400 });
  const database = createSupabaseAdminClient();
  const { data: consultation } = await database.from("consultation_requests").select("id, owner_id, client_name, client_email, consultation_type, expected_amount_cents, payment_status").eq("id", requestId).eq("owner_id", owner.user.id).maybeSingle();
  if (!consultation || consultation.payment_status !== "PAYMENT_SUBMITTED") return NextResponse.json({ error: "This payment proof is no longer pending review." }, { status: 409 });

  const bookingToken = decision.data.decision === "APPROVE" ? createConsultationToken() : null;
  const expiresAt = bookingToken ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null;
  const { data: status, error } = await database.rpc("review_consultation_payment", {
    target_owner: owner.user.id,
    target_request: requestId,
    decision: decision.data.decision,
    rejection_note: decision.data.decision === "REJECT" ? decision.data.reason : null,
    released_token_hash: bookingToken ? hashConsultationToken(bookingToken) : null,
    released_token_expires_at: expiresAt
  });
  if (error) return NextResponse.json({ error: "The payment review could not be saved." }, { status: 503 });
  const notificationSent = await sendConsultationNotification(database, {
    ownerId: owner.user.id,
    requestId,
    clientName: consultation.client_name,
    clientEmail: consultation.client_email,
    consultationName: consultation.consultation_type,
    expectedAmountCents: consultation.expected_amount_cents,
    kind: decision.data.decision === "APPROVE" ? "APPROVED" : "REJECTED",
    bookingToken: bookingToken ?? undefined,
    rejectionReason: decision.data.decision === "REJECT" ? decision.data.reason : undefined
  });
  return NextResponse.json({ status, notificationSent, bookingUrl: bookingToken ? `/consult/book/${bookingToken}` : null });
}
