import { z } from "zod";

export const clientNumberSchema = z.string().trim().toUpperCase().regex(/^KYM-[0-9]{6}$/, "Enter your client number, like KYM-482193.");

export const clientRegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  clientNumber: clientNumberSchema,
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  website: z.string().max(0).optional().or(z.literal(""))
});

export const clientSignInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128)
});

export const clientBookingSchema = z.object({
  clientNumber: clientNumberSchema
});

export const ownerClientCreateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal(""))
});

export const ownerClientUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  isActive: z.boolean()
});

export const ownerPaymentSchema = z.object({
  amountCents: z.number().int().min(1).max(10_000_000),
  status: z.enum(["PENDING", "RECEIVED", "FAILED", "REFUNDED"]),
  note: z.string().trim().max(500).optional().or(z.literal(""))
});

export const ownerJobSchema = z.object({
  title: z.string().trim().min(2).max(160),
  status: z.enum(["INTAKE", "IN_PROGRESS", "WAITING_ON_CLIENT", "COMPLETED", "CLOSED"])
});

export const ownerJobUpdateSchema = z.object({
  body: z.string().trim().min(1).max(1000)
});

export const jobStatusLabels = {
  INTAKE: "Intake",
  IN_PROGRESS: "In progress",
  WAITING_ON_CLIENT: "Waiting on client",
  COMPLETED: "Completed",
  CLOSED: "Closed"
} as const;

export const paymentStatusLabels = {
  PENDING: "Pending",
  RECEIVED: "Received",
  FAILED: "Failed",
  REFUNDED: "Refunded"
} as const;

export const clientSessionDurationMinutes = 15;

export function formatClientAmount(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
