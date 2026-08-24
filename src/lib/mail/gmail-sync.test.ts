import { describe, expect, it } from "vitest";
import { staleProviderAttachmentRowIds, uniqueProviderAttachments } from "@/lib/mail/gmail-sync";

describe("Gmail attachment metadata reconciliation", () => {
  it("deduplicates the current provider payload by attachment ID", () => {
    const current = uniqueProviderAttachments([
      { providerAttachmentId: "current", filename: "resume.pdf" },
      { providerAttachmentId: "current", filename: "resume.pdf" }
    ]);
    expect(current).toHaveLength(1);
  });

  it("removes rows no longer present in the latest provider payload", () => {
    expect(staleProviderAttachmentRowIds([
      { id: "old-row", provider_attachment_id: "old-provider-id" },
      { id: "current-row", provider_attachment_id: "current-provider-id" }
    ], ["current-provider-id"])).toEqual(["old-row"]);
  });
});
