import { describe, expect, it } from "vitest";
import { blockedAttachmentPattern, parseRecipientList, validateComposeInput } from "./compose-validation";

describe("compose validation", () => {
  it("normalizes and deduplicates comma or semicolon separated recipients", () => {
    expect(parseRecipientList("Person@Example.com; second@example.com, person@example.com")).toEqual(["person@example.com", "second@example.com"]);
  });

  it("rejects invalid recipients and header injection", () => {
    expect(parseRecipientList("not-an-email")).toBeNull();
    expect(validateComposeInput({ from: "kym@kymmailapp.com", to: "person@example.com", cc: "", bcc: "", subject: "Hello\nBcc: victim@example.com", body: "Body" })).toBeNull();
  });

  it("blocks executable attachment extensions", () => {
    expect(blockedAttachmentPattern.test("invoice.pdf.exe")).toBe(true);
    expect(blockedAttachmentPattern.test("resume.pdf")).toBe(false);
  });
});

