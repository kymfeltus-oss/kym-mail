export const scheduledAttachmentBucket = "scheduled-mail-attachments";
export const scheduledStatuses = ["SCHEDULED", "PROCESSING", "SENT", "FAILED", "CANCELLED"] as const;
export type ScheduledStatus = (typeof scheduledStatuses)[number];

export const scheduledStatusLabels: Record<ScheduledStatus, string> = {
  SCHEDULED: "Scheduled",
  PROCESSING: "Sending",
  SENT: "Sent",
  FAILED: "Delivery failed",
  CANCELLED: "Cancelled"
};

export const scheduledEventLabels: Record<string, string> = {
  EMAIL_SCHEDULED: "Email scheduled",
  SCHEDULE_EDITED: "Schedule edited",
  EMAIL_RESCHEDULED: "Email rescheduled",
  SCHEDULE_CANCELLED: "Scheduled email cancelled",
  SCHEDULED_EMAIL_SENT: "Scheduled email sent",
  SCHEDULED_DELIVERY_FAILED: "Scheduled delivery failed",
  SCHEDULE_RETRY_QUEUED: "Delivery retry queued"
};

export function scheduledRfcMessageId(id: string) {
  return `<kym-schedule-${id}@kymmailapp.com>`;
}
