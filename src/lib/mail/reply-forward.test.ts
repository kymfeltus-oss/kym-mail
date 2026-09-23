import { describe, expect, it } from "vitest";
import { forwardBody, forwardSubject, replyRecipient, replySubject } from "./reply-forward";

describe("reply and forward drafts", () => {
  it("replies to the external participant for received and sent messages", () => {
    const identities = ["kym@kymmailapp.com", "info@kymmailapp.com"];
    expect(replyRecipient({ fromAddress: "recruiter@example.com", toAddresses: ["kym@kymmailapp.com"], ccAddresses: [] }, identities)).toBe("recruiter@example.com");
    expect(replyRecipient({ fromAddress: "kym@kymmailapp.com", toAddresses: ["recruiter@example.com"], ccAddresses: ["info@kymmailapp.com"] }, identities)).toBe("recruiter@example.com");
  });

  it("adds subject prefixes only when they are missing", () => {
    expect(replySubject("Opportunity")).toBe("Re: Opportunity");
    expect(replySubject("RE: Opportunity")).toBe("RE: Opportunity");
    expect(forwardSubject("Opportunity")).toBe("Fwd: Opportunity");
    expect(forwardSubject("FW: Opportunity")).toBe("FW: Opportunity");
  });

  it("quotes the original message with useful forwarding headers", () => {
    const body = forwardBody({
      fromAddress: "recruiter@example.com",
      toAddresses: ["kym@kymmailapp.com"],
      ccAddresses: ["person@example.com"],
      subject: "Opportunity",
      textBody: "Hello Kym"
    }, "Sep 10, 2026, 9:30 AM");
    expect(body).toContain("---------- Forwarded message ----------");
    expect(body).toContain("From: recruiter@example.com");
    expect(body).toContain("Cc: person@example.com");
    expect(body).toContain("\n\nHello Kym");
  });
});
