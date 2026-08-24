import sanitizeHtml from "sanitize-html";

export type GmailHeader = { name: string; value: string };
export type GmailMessagePart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailMessagePart[];
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: GmailMessagePart;
};

export type NormalizedGmailMessage = {
  providerMessageId: string;
  providerThreadId: string;
  providerHistoryId: string | null;
  internetMessageId: string | null;
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  textBody: string | null;
  sanitizedHtmlBody: string | null;
  snippet: string | null;
  sentAt: string;
  isInbox: boolean;
  isSent: boolean;
  isDraft: boolean;
  isUnread: boolean;
  attachments: Array<{
    providerAttachmentId: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  }>;
};

const EMAIL_PATTERN = /[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+/gi;
const MAX_BODY_CHARS = 1_000_000;

function headerValue(headers: GmailHeader[] | undefined, name: string) {
  return headers?.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
}

export function extractEmailAddresses(value: string): string[] {
  return [...new Set((value.match(EMAIL_PATTERN) ?? []).map((email) => email.toLowerCase()))];
}

function decodeBody(data: string | undefined) {
  if (!data) return "";
  try { return Buffer.from(data, "base64url").toString("utf8").slice(0, MAX_BODY_CHARS); }
  catch { return ""; }
}

export function sanitizeEmailHtml(value: string) {
  return sanitizeHtml(value.slice(0, MAX_BODY_CHARS), {
    allowedTags: ["a", "blockquote", "br", "code", "div", "em", "h1", "h2", "h3", "h4", "hr", "li", "ol", "p", "pre", "span", "strong", "table", "tbody", "td", "th", "thead", "tr", "ul"],
    allowedAttributes: {
      a: ["href", "title"],
      blockquote: ["cite"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"]
    },
    allowedSchemes: ["http", "https", "mailto"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, rel: "noopener noreferrer", target: "_blank" } })
    }
  });
}

function collectParts(part: GmailMessagePart | undefined, result: { plain: string[]; html: string[]; attachments: NormalizedGmailMessage["attachments"] }) {
  if (!part) return;
  const filename = part.filename?.trim();
  if (filename || part.body?.attachmentId) {
    result.attachments.push({
      providerAttachmentId: part.body?.attachmentId ?? `inline:${part.partId ?? `${filename || "attachment"}:${part.body?.size ?? 0}`}`,
      filename: filename || "attachment",
      mimeType: part.mimeType || "application/octet-stream",
      sizeBytes: Math.max(0, part.body?.size ?? 0)
    });
  } else if (part.mimeType === "text/plain") {
    const text = decodeBody(part.body?.data); if (text) result.plain.push(text);
  } else if (part.mimeType === "text/html") {
    const html = decodeBody(part.body?.data); if (html) result.html.push(html);
  }
  part.parts?.forEach((child) => collectParts(child, result));
}

export function normalizeGmailMessage(message: GmailMessage): NormalizedGmailMessage | null {
  if (!message.id || !message.threadId || !message.payload) return null;
  const headers = message.payload.headers;
  const fromAddress = extractEmailAddresses(headerValue(headers, "From"))[0];
  if (!fromAddress) return null;

  const collected = { plain: [] as string[], html: [] as string[], attachments: [] as NormalizedGmailMessage["attachments"] };
  collectParts(message.payload, collected);
  const rawHtml = collected.html.join("\n").trim();
  const sanitizedHtmlBody = rawHtml ? sanitizeEmailHtml(rawHtml) : null;
  const rawText = collected.plain.join("\n").trim();
  const textBody = rawText || (rawHtml ? sanitizeHtml(rawHtml, { allowedTags: [], allowedAttributes: {} }).trim() : "") || null;
  const internalDate = Number(message.internalDate);
  const headerDate = Date.parse(headerValue(headers, "Date"));
  const sentAtMs = Number.isFinite(internalDate) && internalDate > 0 ? internalDate : headerDate;
  if (!Number.isFinite(sentAtMs)) return null;
  const labelIds = new Set(message.labelIds ?? []);

  return {
    providerMessageId: message.id,
    providerThreadId: message.threadId,
    providerHistoryId: message.historyId ?? null,
    internetMessageId: headerValue(headers, "Message-ID") || null,
    fromAddress,
    toAddresses: extractEmailAddresses(headerValue(headers, "To")),
    ccAddresses: extractEmailAddresses(headerValue(headers, "Cc")),
    bccAddresses: extractEmailAddresses(headerValue(headers, "Bcc")),
    subject: headerValue(headers, "Subject") || "(no subject)",
    textBody,
    sanitizedHtmlBody,
    snippet: message.snippet?.trim().slice(0, 500) || null,
    sentAt: new Date(sentAtMs).toISOString(),
    isInbox: labelIds.has("INBOX"),
    isSent: labelIds.has("SENT"),
    isDraft: labelIds.has("DRAFT"),
    isUnread: labelIds.has("UNREAD"),
    attachments: collected.attachments
  };
}
