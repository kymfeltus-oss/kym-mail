import { z } from "zod";

const pubSubEnvelopeSchema = z.object({
  message: z.object({
    data: z.string().min(1),
    messageId: z.string().min(1).optional(),
    message_id: z.string().min(1).optional(),
    publishTime: z.string().optional(),
    publish_time: z.string().optional()
  }).refine((message) => Boolean(message.messageId || message.message_id)),
  subscription: z.string().optional()
});

const gmailNotificationSchema = z.object({
  emailAddress: z.string().trim().email(),
  historyId: z.union([
    z.string().regex(/^\d+$/),
    z.number().int().nonnegative().transform(String)
  ])
});

export type GmailPushNotification = {
  deduplicationKey: string;
  providerEmail: string;
  historyId: string;
  pubSubMessageId: string;
};

export function parseGmailPushNotification(input: unknown): GmailPushNotification | null {
  const envelope = pubSubEnvelopeSchema.safeParse(input);
  if (!envelope.success) return null;

  try {
    const decoded = JSON.parse(Buffer.from(envelope.data.message.data, "base64").toString("utf8"));
    const notification = gmailNotificationSchema.safeParse(decoded);
    if (!notification.success) return null;
    const providerEmail = notification.data.emailAddress.toLowerCase();
    return {
      deduplicationKey: `${providerEmail}:${notification.data.historyId}`,
      providerEmail,
      historyId: notification.data.historyId,
      pubSubMessageId: envelope.data.message.messageId ?? envelope.data.message.message_id!
    };
  } catch {
    return null;
  }
}
