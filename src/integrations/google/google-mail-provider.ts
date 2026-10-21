import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/lib/errors";
import { getGoogleMailEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { googleMailFailure } from "@/lib/mail/google-api-error";
import { loadInlineEmailLogo } from "@/lib/mail/inline-email-assets";
import { buildProfessionalEmailHtml, defaultEmailLookForSender } from "@/lib/mail/professional-html";
import { decryptToken, encryptToken } from "@/lib/mail/token-crypto";
import type { MailProvider, OutgoingMail, ProviderSendResult } from "@/domain/providers/mail-provider";

type ConnectionTokens = { id: string; encrypted_access_token: string | null; encrypted_refresh_token: string | null; token_expires_at: string | null };
type GoogleError = { error?: { code?: number; status?: string; errors?: Array<{ reason?: string }> } };
type GoogleTokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };

export type GoogleDriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  appProperties?: Record<string, string>;
};

export type DriveUploadSession = { sessionUrl: string };

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
    let response: Response;
    try {
      response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: decryptToken(this.connection.encrypted_refresh_token), grant_type: "refresh_token" }) });
    } catch (error) {
      log("error", "mail.google_token_refresh_failed", { reason: error instanceof Error ? error.name : "unknown" });
      throw new AppError("PROVIDER_UNAVAILABLE", "Google authorization is temporarily unavailable. Try syncing again shortly.");
    }
    const token = await response.json().catch(() => ({})) as GoogleTokenResponse;
    if (!response.ok) {
      if (token.error === "invalid_grant") return this.requireReauthorization();
      log("error", "mail.google_token_refresh_failed", { status: response.status, providerError: token.error ?? "unknown" });
      throw new AppError("PROVIDER_UNAVAILABLE", "Google authorization is temporarily unavailable. Try syncing again shortly.", { status: response.status, providerStatus: token.error ?? null });
    }
    if (!token.access_token || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
      log("error", "mail.google_token_refresh_failed", { status: response.status, providerError: "invalid_token_response" });
      throw new AppError("PROVIDER_UNAVAILABLE", "Google authorization returned an invalid response. Try syncing again shortly.");
    }
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
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as GoogleError;
      const requestPath = path.split("?")[0] || path;
      const reason = body.error?.errors?.[0]?.reason;
      const failure = googleMailFailure(response.status, body.error?.status, reason);
      log("error", "mail.google_api_failed", { status: failure.status, providerStatus: failure.providerStatus, providerReason: reason ?? null, path: requestPath });
      if (response.status === 403 && reason === "insufficientPermissions") return this.requireReauthorization();
      throw new AppError("PROVIDER_UNAVAILABLE", failure.safeMessage, { status: failure.status, providerStatus: failure.providerStatus, path: requestPath });
    }
    return response.json() as Promise<T>;
  }

  private async driveRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`https://www.googleapis.com/drive/v3${path}`, { ...init, headers: { authorization: `Bearer ${await this.accessToken()}`, "content-type": "application/json", ...init?.headers } });
    if (response.status === 401) return this.requireReauthorization();
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as GoogleError;
      const insufficientScope = response.status === 403 && body.error?.errors?.some((item) => item.reason === "insufficientPermissions");
      if (insufficientScope) throw new AppError("UNAUTHORIZED", "Reconnect Google Mail and approve Google Drive access to upload large files.");
      const reason = body.error?.errors?.[0]?.reason;
      const failure = googleMailFailure(response.status, body.error?.status, reason);
      log("error", "mail.google_drive_api_failed", { status: failure.status, providerStatus: failure.providerStatus, providerReason: reason ?? null, path: path.split("?")[0] });
      throw new AppError("PROVIDER_UNAVAILABLE", response.status === 403 ? "Google Drive could not share this file. Check your account's sharing settings." : failure.safeMessage, { status: failure.status, providerStatus: failure.providerStatus });
    }
    return response.json() as Promise<T>;
  }

  async startDriveUpload({ name, mimeType, size, ownerId }: { name: string; mimeType: string; size: number; ownerId: string }): Promise<DriveUploadSession> {
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size,webViewLink,appProperties", {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json; charset=UTF-8",
        "x-upload-content-type": mimeType,
        "x-upload-content-length": String(size)
      },
      body: JSON.stringify({
        name,
        mimeType,
        appProperties: { kymMailOwner: ownerId, kymMailConnection: this.connection.id, kymMailPurpose: "email-link-attachment" }
      })
    });
    if (response.status === 401) return this.requireReauthorization();
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as GoogleError;
      const insufficientScope = response.status === 403 && body.error?.errors?.some((item) => item.reason === "insufficientPermissions");
      if (insufficientScope) throw new AppError("UNAUTHORIZED", "Reconnect Google Mail and approve Google Drive access to upload large files.");
      const reason = body.error?.errors?.[0]?.reason;
      const failure = googleMailFailure(response.status, body.error?.status, reason);
      log("error", "mail.google_drive_upload_start_failed", { status: failure.status, providerStatus: failure.providerStatus, providerReason: reason ?? null });
      throw new AppError("PROVIDER_UNAVAILABLE", failure.safeMessage, { status: failure.status, providerStatus: failure.providerStatus });
    }
    const sessionUrl = response.headers.get("location");
    if (!sessionUrl) throw new AppError("PROVIDER_UNAVAILABLE", "Google Drive could not start the large-file upload.");
    const parsedUrl = new URL(sessionUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "www.googleapis.com" || !parsedUrl.pathname.startsWith("/upload/drive/v3/files")) {
      throw new AppError("PROVIDER_UNAVAILABLE", "Google Drive returned an invalid upload session.");
    }
    return { sessionUrl };
  }

  getDriveFile(fileId: string) {
    const params = new URLSearchParams({ fields: "id,name,mimeType,size,webViewLink,appProperties" });
    return this.driveRequest<GoogleDriveFile>(`/files/${encodeURIComponent(fileId)}?${params}`);
  }

  async shareDriveFileWithAnyone(fileId: string) {
    const params = new URLSearchParams({ fields: "permissions(id,type,role,allowFileDiscovery)" });
    const current = await this.driveRequest<{ permissions?: Array<{ id: string; type: string; role: string; allowFileDiscovery?: boolean }> }>(`/files/${encodeURIComponent(fileId)}/permissions?${params}`);
    const existing = current.permissions?.find((permission) => permission.type === "anyone");
    if (existing?.role === "reader" && existing.allowFileDiscovery === false) return;
    if (existing) {
      await this.driveRequest(`/files/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(existing.id)}?fields=id`, { method: "PATCH", body: JSON.stringify({ role: "reader", allowFileDiscovery: false }) });
      return;
    }
    const createParams = new URLSearchParams({ sendNotificationEmail: "false", fields: "id,type,role" });
    await this.driveRequest(`/files/${encodeURIComponent(fileId)}/permissions?${createParams}`, { method: "POST", body: JSON.stringify({ type: "anyone", role: "reader", allowFileDiscovery: false }) });
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
  async listHistory(startHistoryId: string, maxPages = 8) {
    let pageToken: string | undefined; const ids = new Set<string>(); const deletedIds = new Set<string>(); let latestHistoryId = startHistoryId; let pages = 0; let truncated = false;
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
      latestHistoryId = data.historyId; pageToken = data.nextPageToken; pages += 1;
      if (pageToken && pages >= maxPages) truncated = true;
    } while (pageToken && !truncated);
    deletedIds.forEach((id) => ids.delete(id));
    return { messageIds: [...ids], deletedMessageIds: [...deletedIds], latestHistoryId, truncated };
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
    const defaultLook = defaultEmailLookForSender(message.from);
    const fallbackInlineImages = message.htmlBody ? [] : await loadInlineEmailLogo(defaultLook);
    const inlineImages = [...(message.inlineImages ?? []), ...fallbackInlineImages];
    const htmlBody = message.htmlBody ?? buildProfessionalEmailHtml({
      from: message.from,
      subject: message.subject,
      body: message.textBody,
      look: defaultLook,
      logoImageSource: fallbackInlineImages[0] ? `cid:${fallbackInlineImages[0].contentId}` : undefined
    });
    const alternativeBoundary = `kym_alt_${crypto.randomUUID()}`;
    const alternative = [
      `--${alternativeBoundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(message.textBody),
      `--${alternativeBoundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      base64Lines(htmlBody),
      `--${alternativeBoundary}--`
    ];
    let messageBody: string[];
    if (inlineImages.length) {
      const relatedBoundary = `kym_related_${crypto.randomUUID()}`;
      const related = [
        `--${relatedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
        "",
        ...alternative
      ];
      for (const image of inlineImages) {
        const filename = safeHeader(image.filename).replaceAll('"', "") || "image";
        const contentId = safeHeader(image.contentId).replace(/[<>]/g, "");
        related.push(
          `--${relatedBoundary}`,
          `Content-Type: ${safeHeader(image.mimeType)}; name="${filename}"`,
          "Content-Transfer-Encoding: base64",
          `Content-ID: <${contentId}>`,
          `Content-Disposition: inline; filename="${filename}"`,
          "",
          base64Lines(image.content)
        );
      }
      related.push(`--${relatedBoundary}--`);
      messageBody = [`Content-Type: multipart/related; type="multipart/alternative"; boundary="${relatedBoundary}"`, "", ...related];
    } else {
      messageBody = [`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, "", ...alternative];
    }
    let mime: string[];
    if (!attachments.length) {
      mime = [...headers, ...messageBody];
    } else {
      const parts = [`--${boundary}`, ...messageBody];
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
