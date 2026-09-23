import { describe, expect, it } from "vitest";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_COUNT, selectForwardableAttachments, validateAttachmentEntries } from "./attachment-validation";

describe("attachment selection validation", () => {
  it("accepts safe attachments within the combined limits", () => {
    expect(validateAttachmentEntries([{ name: "original.pdf", size: 1024 }, { name: "new.docx", size: 2048 }])).toBe(true);
  });

  it("rejects blocked, oversized, or excessive attachments", () => {
    expect(validateAttachmentEntries([{ name: "payload.exe", size: 100 }])).toBe(false);
    expect(validateAttachmentEntries([{ name: "large.pdf", size: MAX_ATTACHMENT_BYTES + 1 }])).toBe(false);
    expect(validateAttachmentEntries(Array.from({ length: MAX_ATTACHMENT_COUNT + 1 }, (_, index) => ({ name: `${index}.txt`, size: 1 })))).toBe(false);
  });

  it("selects only original attachments that can be forwarded safely", () => {
    const selected = selectForwardableAttachments([
      { name: "keep.pdf", size: 1024, providerAttachmentId: "provider-1" },
      { name: "inline.png", size: 512, providerAttachmentId: "inline:part-2" },
      { name: "drop.exe", size: 100, providerAttachmentId: "provider-3" }
    ]);
    expect(selected).toEqual([{ name: "keep.pdf", size: 1024, providerAttachmentId: "provider-1" }]);
  });
});
