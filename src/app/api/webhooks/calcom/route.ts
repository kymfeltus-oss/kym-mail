import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getConsultationWebhookEnv } from "@/lib/env";
import { parseCalWebhook, verifyCalWebhookSignature } from "@/lib/consultations/provider";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-cal-signature-256");
  let secret: string;
  try { secret = getConsultationWebhookEnv().CALCOM_WEBHOOK_SECRET; }
  catch { return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 }); }
  if (!verifyCalWebhookSignature(rawBody, signature, secret)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });

  const database = createSupabaseAdminClient();
  const fingerprint = createHash("sha256").update(rawBody).digest("hex");
  try {
    const event = parseCalWebhook(rawBody);
    if (!event.requestId) return NextResponse.json({ error: "Consultation request metadata is required." }, { status: 400 });
    const { data: consultation } = await database.from("consultation_requests").select("id, owner_id, client_email, payment_status, provider_booking_id").eq("id", event.requestId).maybeSingle();
    if (!consultation || event.attendeeEmail !== consultation.client_email) return NextResponse.json({ error: "Consultation booking does not match." }, { status: 404 });

    const { error: eventInsertError } = await database.from("consultation_provider_events").insert({ owner_id: consultation.owner_id, consultation_request_id: consultation.id, provider: "CAL_COM", event_fingerprint: fingerprint, provider_booking_id: event.bookingId, event_type: event.triggerEvent });
    if (eventInsertError?.code === "23505") {
      const { data: prior } = await database.from("consultation_provider_events").select("processed_at").eq("event_fingerprint", fingerprint).maybeSingle();
      if (prior?.processed_at) return NextResponse.json({ processed: true, duplicate: true });
    } else if (eventInsertError) throw new Error("CALCOM_EVENT_PERSISTENCE_FAILED");

    if (event.triggerEvent === "BOOKING_CANCELLED") {
      if (consultation.provider_booking_id && consultation.provider_booking_id !== event.bookingId) throw new Error("CALCOM_BOOKING_MISMATCH");
      const { error: updateError } = await database.from("consultation_requests").update({ payment_status: "CANCELLED", cancelled_at: new Date().toISOString() }).eq("id", consultation.id).eq("owner_id", consultation.owner_id);
      if (updateError) throw new Error("CALCOM_BOOKING_UPDATE_FAILED");
    } else {
      if (!["BOOKING_RELEASED", "BOOKED"].includes(consultation.payment_status)) throw new Error("CALCOM_BOOKING_NOT_RELEASED");
      if (consultation.provider_booking_id && consultation.provider_booking_id !== event.bookingId) throw new Error("CALCOM_BOOKING_MISMATCH");
      const { error: updateError } = await database.from("consultation_requests").update({
        payment_status: "BOOKED",
        provider_booking_id: event.bookingId,
        provider_event_type_id: event.eventTypeId,
        booking_start_at: event.startTime,
        booking_end_at: event.endTime,
        booking_timezone: event.timezone,
        booking_title: event.title,
        booked_at: new Date().toISOString(),
        cancelled_at: null
      }).eq("id", consultation.id).eq("owner_id", consultation.owner_id);
      if (updateError) throw new Error("CALCOM_BOOKING_UPDATE_FAILED");
    }
    const { error: auditError } = await database.from("consultation_events").insert({ owner_id: consultation.owner_id, consultation_request_id: consultation.id, event_type: event.triggerEvent, actor_type: "PROVIDER", details: { provider: "CAL_COM", bookingId: event.bookingId } });
    if (auditError) throw new Error("CALCOM_BOOKING_AUDIT_FAILED");
    const { error: processedError } = await database.from("consultation_provider_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("event_fingerprint", fingerprint);
    if (processedError) throw new Error("CALCOM_EVENT_FINALIZATION_FAILED");
    log("info", "consultation.calcom_webhook_processed", { requestId: consultation.id, trigger: event.triggerEvent });
    return NextResponse.json({ processed: true });
  } catch (error) {
    await database.from("consultation_provider_events").update({ processed_at: new Date().toISOString(), processing_error: "The provider event could not be reconciled." }).eq("event_fingerprint", fingerprint);
    log("error", "consultation.calcom_webhook_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    return NextResponse.json({ error: "Webhook could not be processed." }, { status: 400 });
  }
}
