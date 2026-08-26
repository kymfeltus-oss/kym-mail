import { z } from "zod";
import { consultationKinds } from "@/lib/consultations/offerings";

const calUrl = z.string().trim().url().superRefine((value, context) => {
  const url = new URL(value);
  if (url.protocol !== "https:" || (url.hostname !== "cal.com" && !url.hostname.endsWith(".cal.com"))) {
    context.addIssue({ code: "custom", message: "Enter a secure Cal.com URL." });
  }
});

export const consultationSubmissionSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  phone: z.string().trim().min(7).max(30).optional().or(z.literal("")),
  consultationKind: z.enum(consultationKinds),
  note: z.string().trim().max(1000).optional().or(z.literal("")),
  website: z.string().max(0).optional().or(z.literal(""))
});

export const consultationSettingsSchema = z.object({
  cashAppHandle: z.string().trim().regex(/^\$[A-Za-z0-9_]{1,20}$/, "Use a Cash App handle beginning with $."),
  paymentInstructions: z.string().trim().min(10).max(1000),
  referenceInstructions: z.string().trim().max(500).optional().or(z.literal("")),
  firstTimeBookingUrl: calUrl,
  returningBookingUrl: calUrl,
  isActive: z.boolean()
});

export const consultationReviewSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({ decision: z.literal("REJECT"), reason: z.string().trim().min(3).max(500) })
]);

export function formatConsultationAmount(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
