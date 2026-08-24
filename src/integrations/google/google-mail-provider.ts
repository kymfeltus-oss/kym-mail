import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getGoogleMailEnv } from "@/lib/env";
import { decryptToken, encryptToken } from "@/lib/mail/token-crypto";
import type { MailProvider, OutgoingMail, ProviderSendResult } from "@/domain/providers/mail-provider";

type ConnectionTokens = { id: string; encrypted_access_token: string | null; encrypted_refresh_token: string | null; token_expires_at: string | null };
type GoogleError = { error?: { code?: number; message?: string; status?: string } };

function safeHeader(value: string) { return value.replace(/[\r\n]+/g, " ").trim(); }
function base64Lines(value: Uint8Array | string) {
  const encoded = Buffer.from(value).toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") ?? "";
}

export class GoogleMailProvider implements MailProvider {
  readonly id = "google";
  constructor(private readonly connection: ConnectionTokens, private readonly database: SupabaseClient) {}

  private async accessToken(): Promise<string> {
    if (this.connection.encrypted_access_token && this.connection.token_expires_at && new Date(this.connection.token_expires_at).getTime() > Date.now() + 60_000) return decryptToken(this.connection.encrypted_access_token);
    if (!this.connection.encrypted_refresh_token) return this.requireReauthorization();
    const env = getGoogleMailEnv();
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: decryptToken(this.connection.encrypted_refresh_token), grant_type: "refresh_token" }) });
    if (!response.ok) return this.requireReauthorization();
    const token = await response.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + token.expires_in * 1000);
    const encrypted = encryptToken(token.access_token);
    const { error } = await this.database.from("mail_connection_credentials").update({ encrypted_access_token: encrypted, token_expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() }).eq("mail_connection_id", this.connection.id);
    await this.database.from("mail_connections").update({ connection_state: "connected", sync_error: null, updated_at: new Date().toISOString() }).eq("id", this.connection.id);
    if (error) throw new AppError("INTERNAL", "Mail authorization could not be persisted.");
    this.connection.encrypted_access_token = encrypted; this.connection.token_expires_at = expiresAt.toISOString();
    return token.access_token;
  }

  private async requireReauthorization(): Promise<never> {
    await this.database.from("mail_connections").update({ connection_state: "reauth_required", sync_error: "Authorization must be renewed.", updated_at: new Date().toISOString() }).eq("id", this.connection.id);
    throw new AppError("UNAUTHORIZED", "Reconnect this mail account to continue.");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, { ...init, headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json", ...init?.headers } });
    if (response.status === 401) return this.requireReauthorization();
    if (!response.ok) { const body = await response.json().catch(() => ({})) as GoogleError; throw new AppError("PROVIDER_UNAVAILABLE", "Google Mail is temporarily unavailable.", { status: response.status, providerStatus: body.error?.status }); }
    return response.json() as Promise<T>;
  }

  healthCheck() { return this.request("/profile").then(() => ({ available: true })).catch(() => ({ available: false })); }
  getProfile() { return this.request<{ emailAddress: string; messagesTotal: number; threadsTotal: number; historyId: string }>("/profile"); }
  async listMessageIds(query: string, maxResults: number) {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const data = await this.request<{ messages?: Array<{ id: string; threadId: string }> }>(`/messages?${params}`);
    return (data.messages ?? []).map(({ id, threadId }) => ({ messageId: id, threadId }));
  }
  getMessage(messageId: string) { return this.request(`/messages/${encodeURIComponent(messageId)}?format=full`); }
  getAttachment(messageId: string, attachmentId: string) { return this.request<{ data: string; size: number }>(`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`); }
  async listHistory(startHistoryId: string) {
    let pageToken: string | undefined; const ids = new Set<string>(); const deletedIds = new Set<string>(); let latestHistoryId = startHistoryId;
    do {
      const params = new URLSearchParams({ startHistoryId }); if (pageToken) params.set("pageToken", pageToken);
      const data = await this.request<{
        history?: Array<{
          messagesAdded?: Array<{ message: { id: string } }>;
          messagesDeleted?: Array<{ message: { id: string } }>;
          labelsAdded?: Array<{ message: { id: string } }>;
          labelsRemoved?: Array<{ message: { id: string } }>;
        }>;
        historyId: string;
        nextPageToken?: string;
      }>(`/history?${params}`);
      data.history?.forEach((entry) => {
        entry.messagesAdded?.forEach(({ message }) => ids.add(message.id));
        entry.labelsAdded?.forEach(({ message }) => ids.add(message.id));
        entry.labelsRemoved?.forEach(({ message }) => ids.add(message.id));
        entry.messagesDeleted?.forEach(({ message }) => deletedIds.add(message.id));
      });
      latestHistoryId = data.historyId; pageToken = data.nextPageToken;
    } while (pageToken);
    deletedIds.forEach((id) => ids.delete(id));
    return { messageIds: [...ids], deletedMessageIds: [...deletedIds], latestHistoryId };
  }
  async send(message: OutgoingMail): Promise<ProviderSendResult> {
    const boundary = `kym_${crypto.randomUUID()}`;
    const headers = [
      `From: ${safeHeader(message.from)}`,
      `To: ${message.to.map(safeHeader).join(", ")}`,
      ...(message.cc?.length ? [`Cc: ${message.cc.map(safeHeader).join(", ")}`] : []),
      ...(message.bcc?.length ? [`Bcc: ${message.bcc.map(safeHeader).join(", ")}`] : []),
      `Subject: =?UTF-8?B?${Buffer.from(safeHeader(message.subject)).toString("base64")}?=`,
      `Date: ${new Date().toUTCString()}`,
      ...(message.messageId ? [`Message-ID: ${safeHeader(message.messageId)}`] : []),
      "MIME-Version: 1.0",
      ...(message.replyToMessageId ? [`In-Reply-To: ${safeHeader(message.replyToMessageId)}`, `References: ${safeHeader(message.replyToMessageId)}`] : [])
    ];
    const attachments = message.attachments ?? [];
    let mime: string[];
    if (!attachments.length) {
      mime = [...headers, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(message.textBody)];
    } else {
      const parts = [`--${boundary}`, "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", base64Lines(message.textBody)];
      for (const attachment of attachments) {
        const filename = safeHeader(attachment.filename).replaceAll('"', "") || "attachment";
        parts.push(`--${boundary}`, `Content-Type: ${safeHeader(attachment.mimeType)}; name=\"${filename}\"`, "Content-Transfer-Encoding: base64", `Content-Disposition: attachment; filename=\"${filename}\"`, "", base64Lines(attachment.content));
      }
      parts.push(`--${boundary}--`);
      mime = [...headers, `Content-Type: multipart/mixed; boundary=\"${boundary}\"`, "", ...parts];
    }
    const raw = Buffer.from(mime.join("\r\n")).toString("base64url");
    const data = await this.request<{ id: string; threadId: string; historyId?: string }>("/messages/send", { method: "POST", body: JSON.stringify({ raw, threadId: message.threadId }) });
    return { messageId: data.id, threadId: data.threadId, historyId: data.historyId };
  }
  async createWatch(topicName: string) {
    const data = await this.request<{ historyId: string; expiration: string }>("/watch", { method: "POST", body: JSON.stringify({ topicName, labelIds: ["INBOX", "SENT"] }) });
    return { historyId: data.historyId, expiration: new Date(Number(data.expiration)) };
  }
}
