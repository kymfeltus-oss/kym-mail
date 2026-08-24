import { describe, expect, it } from "vitest";
import { extractEmailAddresses, normalizeGmailMessage, sanitizeEmailHtml } from "./gmail-message";

describe("Gmail message normalization", () => {
  it("extracts normalized unique addresses", () => {
    expect(extractEmailAddresses('Kym <KYM@Example.com>, "Info" <info@example.com>, kym@example.com')).toEqual(["kym@example.com", "info@example.com"]);
  });

  it("removes executable and remote-image HTML", () => {
    const sanitized = sanitizeEmailHtml('<p>Hello</p><img src="https://tracker.example/pixel"><script>alert(1)</script><a href="javascript:alert(1)">bad</a>');
    expect(sanitized).toContain("<p>Hello</p>");
    expect(sanitized).not.toContain("img");
    expect(sanitized).not.toContain("script");
    expect(sanitized).not.toContain("javascript:");
  });

  it("normalizes labels, bodies, headers, and attachment metadata", () => {
    const normalized = normalizeGmailMessage({
      id: "message-1",
      threadId: "thread-1",
      historyId: "42",
      internalDate: "1700000000000",
      labelIds: ["INBOX", "UNREAD"],
      snippet: "A real message",
      payload: {
        mimeType: "multipart/mixed",
        headers: [
          { name: "From", value: "Recruiter <recruiter@example.com>" },
          { name: "To", value: "Kym <kym@kymmailapp.com>" },
          { name: "Subject", value: "Opportunity" },
          { name: "Message-ID", value: "<message@example.com>" }
        ],
        parts: [
          { mimeType: "text/plain", body: { data: Buffer.from("Hello Kym").toString("base64url") } },
          { mimeType: "application/pdf", filename: "role.pdf", body: { attachmentId: "attachment-1", size: 1234 } }
        ]
      }
    });
    expect(normalized).toMatchObject({
      fromAddress: "recruiter@example.com",
      toAddresses: ["kym@kymmailapp.com"],
      subject: "Opportunity",
      textBody: "Hello Kym",
      isInbox: true,
      isUnread: true,
      attachments: [{ providerAttachmentId: "attachment-1", filename: "role.pdf", sizeBytes: 1234 }]
    });
  });
});

