export const consultationPaymentStatuses = [
  "AWAITING_PAYMENT",
  "PAYMENT_SUBMITTED",
  "PAYMENT_APPROVED",
  "PAYMENT_REJECTED",
  "BOOKING_RELEASED",
  "BOOKED",
  "CANCELLED"
] as const;

export type ConsultationPaymentStatus = (typeof consultationPaymentStatuses)[number];

export type ConsultationSettings = {
  owner_id: string;
  consultation_name: string;
  duration_minutes: number;
  price_cents: number;
  cash_app_handle: string;
  payment_instructions: string;
  reference_instructions: string | null;
  paid_booking_url: string;
  free_booking_url: string;
  scheduling_provider: "CAL_COM";
  is_active: boolean;
};
export type ConsultationRequest = {
  id: string;
  owner_id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  consultation_type: string;
  expected_amount_cents: number;
  client_note: string | null;
  proof_object_path: string;
  proof_filename: string;
  proof_mime_type: string;
  proof_size_bytes: number;
  payment_status: ConsultationPaymentStatus;
  booking_token_expires_at: string | null;
  booking_released_at: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  provider_booking_id: string | null;
  booking_start_at: string | null;
  booking_end_at: string | null;
  booking_timezone: string | null;
  booking_title: string | null;
  created_at: string;
  updated_at: string;
};
