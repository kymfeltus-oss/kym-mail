import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consultationProofBucket, consultationProofPath, validateConsultationProof } from "@/lib/consultations/proof";
import { createConsultationToken, hashConsultationToken } from "@/lib/consultations/tokens";
import { consultationSubmissionSchema } from "@/lib/consultations/validation";
import { sendConsultationNotification } from "@/lib/consultations/notifications";
import { consultationKindForHistory, consultationOffering } from "@/lib/consultations/offerings";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const database = createSupabaseAdminClient();
  let uploadedPath: string | null = null;
  try {
    const form = await request.formData();
    const input = consultationSubmissionSchema.parse({
      name: form.get("name"), email: form.get("email"), phone: form.get("phone") ?? "",
      consultationKind: form.get("consultationKind"), note: form.get("note") ?? "", website: form.get("website") ?? ""
    });
    const proofFile = form.get("paymentProof");
    if (!(proofFile instanceof File)) return NextResponse.json({ error: "Upload a PNG, JPG, JPEG, or PDF payment proof." }, { status: 400 });
    const proof = await validateConsultationProof(proofFile);
    if (!proof) return NextResponse.json({ error: "Payment proof must be a valid PNG, JPG, JPEG, or PDF no larger than 8 MB." }, { status: 400 });

    const { data: settingsRows, error: settingsError } = await database.from("consultation_settings").select("*").eq("is_active", true).limit(2);
    if (settingsError || settingsRows?.length !== 1) return NextResponse.json({ error: "Consultation intake is temporarily unavailable." }, { status: 503 });
    const settings = settingsRows[0];
    const { count: completedFirstTimeCount, error: historyError } = await database.from("consultation_requests")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", settings.owner_id)
      .eq("client_email", input.email)
      .eq("consultation_kind", "FIRST_TIME")
      .eq("payment_status", "BOOKED")
      .lt("booking_end_at", new Date().toISOString());
    if (historyError) throw new Error("CONSULTATION_HISTORY_LOOKUP_FAILED");
    const eligibleKind = consultationKindForHistory((completedFirstTimeCount ?? 0) > 0);
    if (input.consultationKind !== eligibleKind) {
      return NextResponse.json({ error: eligibleKind === "FIRST_TIME" ? "First-time clients must use the first-time consultation." : "Your completed consultation history qualifies for the returning-client consultation." }, { status: 400 });
    }
    const offering = consultationOffering(eligibleKind);

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await database.from("consultation_requests").select("id", { count: "exact", head: true }).eq("client_email", input.email).gte("created_at", since);
    if ((count ?? 0) >= 3) return NextResponse.json({ error: "Too many recent submissions. Please try again later." }, { status: 429 });

    const requestId = randomUUID();
    const statusToken = createConsultationToken();
    uploadedPath = consultationProofPath(settings.owner_id, requestId, proof.safeName);
    const { error: uploadError } = await database.storage.from(consultationProofBucket).upload(uploadedPath, proof.content, { contentType: proof.mimeType, upsert: false });
    if (uploadError) throw new Error("CONSULTATION_PROOF_UPLOAD_FAILED");

    const { error: insertError } = await database.from("consultation_requests").insert({
      id: requestId,
      owner_id: settings.owner_id,
      client_name: input.name,
      client_email: input.email,
      client_phone: input.phone || null,
      consultation_type: offering.name,
      consultation_kind: offering.kind,
      expected_amount_cents: offering.priceCents,
      client_note: input.note || null,
      proof_object_path: uploadedPath,
      proof_filename: proof.safeName,
      proof_mime_type: proof.mimeType,
      proof_size_bytes: proof.sizeBytes,
      proof_sha256: proof.sha256,
      payment_status: "PAYMENT_SUBMITTED",
      status_token_hash: hashConsultationToken(statusToken)
    });
    if (insertError) throw new Error("CONSULTATION_REQUEST_PERSISTENCE_FAILED");
    await database.from("consultation_events").insert({ owner_id: settings.owner_id, consultation_request_id: requestId, event_type: "PAYMENT_PROOF_SUBMITTED", actor_type: "CLIENT" });

    const notification = { ownerId: settings.owner_id, requestId, clientName: input.name, clientEmail: input.email, consultationName: offering.name, expectedAmountCents: offering.priceCents };
    const [clientNotified, ownerNotified] = await Promise.all([
      sendConsultationNotification(database, { ...notification, kind: "PROOF_RECEIVED" }),
      sendConsultationNotification(database, { ...notification, kind: "OWNER_REVIEW" })
    ]);
    log("info", "consultation.payment_proof_submitted", { requestId, clientNotified, ownerNotified });
    return NextResponse.json({ requestId, status: "PAYMENT_SUBMITTED", statusUrl: `/consult/status/${statusToken}` }, { status: 201 });
  } catch (error) {
    if (uploadedPath) await database.storage.from(consultationProofBucket).remove([uploadedPath]);
    log("error", "consultation.submission_failed", { code: error instanceof Error ? error.message : "UNKNOWN" });
    return NextResponse.json({ error: "The consultation request could not be submitted. Check the form and try again." }, { status: 400 });
  }
}
