export const clientSessionCookie = "kym_client_session";
export const clientSessionTtlMs = 30 * 24 * 60 * 60 * 1000;

export type ClientRecord = {
  id: string;
  owner_id: string;
  client_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  registered_at: string | null;
};

export type ClientPayment = {
  id: string;
  amount_cents: number;
  status: "PENDING" | "RECEIVED" | "FAILED" | "REFUNDED";
  note: string | null;
  occurred_at: string;
};

export type ClientJob = {
  id: string;
  title: string;
  status: "INTAKE" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "COMPLETED" | "CLOSED";
  updated_at: string;
  created_at: string;
};

export type ClientJobUpdate = {
  id: string;
  job_id: string;
  body: string;
  created_at: string;
};

export type ClientSessionBooking = {
  id: string;
  duration_minutes: number;
  status: "RELEASED" | "BOOKED" | "CANCELLED";
  booking_start_at: string | null;
  booking_end_at: string | null;
  booking_timezone: string | null;
  booking_title: string | null;
  created_at: string;
};
