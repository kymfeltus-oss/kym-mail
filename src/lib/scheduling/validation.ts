import { z } from "zod";
import { scheduledStatuses } from "@/lib/scheduling/constants";

const timingSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(100)
});

export const scheduledEditSchema = z.object({
  from: z.string().trim().toLowerCase().email().max(254),
  to: z.string().max(25_500),
  cc: z.string().max(25_500).default(""),
  bcc: z.string().max(25_500).default(""),
  subject: z.string().trim().min(1).max(200).refine((value) => !/[\r\n]/.test(value)),
  body: z.string().trim().min(1).max(500_000),
  projectId: z.union([z.literal(""), z.string().uuid()]).default(""),
  version: z.coerce.number().int().positive()
});

export const scheduledMutationSchema = z.object({
  action: z.enum(["cancel", "reschedule", "retry"]),
  version: z.coerce.number().int().positive(),
  scheduledFor: z.string().optional(),
  timezone: z.string().optional()
});

export const scheduledStatusSchema = z.enum(scheduledStatuses);

export function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function validateScheduleTiming(input: unknown, now = new Date()) {
  const parsed = timingSchema.safeParse(input);
  if (!parsed.success || !isValidTimeZone(parsed.data.timezone)) return null;
  const instant = new Date(parsed.data.scheduledFor);
  if (!Number.isFinite(instant.getTime()) || instant.getTime() <= now.getTime()) return null;
  return { scheduledFor: instant.toISOString(), timezone: parsed.data.timezone };
}
