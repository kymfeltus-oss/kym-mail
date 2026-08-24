export type MailAddress = { email: string; name?: string };
export type MailAttachmentInput = { filename: string; mimeType: string; content: Uint8Array };
export type OutgoingMail = {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: MailAttachmentInput[];
  replyToMessageId?: string;
  threadId?: string;
};
export type ProviderSendResult = { messageId: string; threadId: string; historyId?: string };
export type ProviderMessageSummary = { messageId: string; threadId: string };

/** Vendor-neutral Gate 2 boundary. Google-specific DTOs remain in its adapter. */
export interface MailProvider {
  readonly id: string;
  healthCheck(): Promise<{ available: boolean }>;
  listMessageIds(query: string, maxResults: number): Promise<ProviderMessageSummary[]>;
  getMessage(messageId: string): Promise<unknown>;
  listHistory(startHistoryId: string): Promise<{ messageIds: string[]; deletedMessageIds: string[]; latestHistoryId: string }>;
  send(message: OutgoingMail): Promise<ProviderSendResult>;
  createWatch(topicName: string): Promise<{ historyId: string; expiration: Date }>;
}
