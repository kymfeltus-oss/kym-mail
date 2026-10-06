import { describe, expect, it } from "vitest";
import { addBusinessDays, classifyInbound, fillFollowUp, firstFollowUpAt, liveReplyAlert, nameFromEmail, secondFollowUpAt } from "@/lib/mail/follow-up";

const chicago = "America/Chicago";

describe("outreach send windows", () => {
  it("waits four business days and lands on a Tuesday through Thursday morning", () => {
    const sent = new Date("2026-10-06T15:00:00.000Z");
    expect(firstFollowUpAt(sent, chicago, sent).toISOString()).toBe("2026-10-13T15:00:00.000Z");
  });

  it("places the final note at least five business days after the first follow-up", () => {
    const followUp = new Date("2026-10-13T15:00:00.000Z");
    expect(secondFollowUpAt(followUp, chicago, followUp).toISOString()).toBe("2026-10-20T15:00:00.000Z");
  });

  it("skips weekends when counting business days", () => {
    expect(addBusinessDays(new Date("2026-10-09T15:00:00.000Z"), 1, chicago).toISOString()).toBe("2026-10-12T15:00:00.000Z");
  });
});

describe("live reply classification", () => {
  it("ignores out-of-office notes and treats delivery failures as bounces", () => {
    expect(classifyInbound({ from: "cfo@example.com", subject: "Automatic reply: Re: close", text: "I am out of the office." })).toBe("ooo");
    expect(classifyInbound({ from: "mailer-daemon@example.com", subject: "Delivery Status Notification (Failure)", text: "" })).toBe("bounce");
    expect(classifyInbound({ from: "cfo@example.com", subject: "Re: close", text: "Let's talk Thursday." })).toBe("reply");
    expect(classifyInbound({ from: "cfo@example.com", subject: "Re: close", text: "Please remove me from this list." })).toBe("dnc");
    expect(classifyInbound({ from: "cfo@example.com", subject: "OOO", text: "Automated response: I am away." })).toBe("ooo");
  });

  it("names the sender in the text alert", () => {
    expect(nameFromEmail("alex.morgan@example.com")).toBe("Alex Morgan");
    expect(fillFollowUp("Hi [Name],", "Alex Morgan")).toBe("Hi Alex Morgan,");
    expect(liveReplyAlert()).toBe("Live response received! Check your inbox immediately to review the reply.");
  });
});
