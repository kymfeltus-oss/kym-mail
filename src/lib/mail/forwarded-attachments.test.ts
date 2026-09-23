import { describe, expect, it } from "vitest";
import { parseForwardAttachmentIds } from "./forwarded-attachments";

describe("forwarded attachment selection", () => {
  const firstId = "9fb91c1f-c437-4f38-9afd-d68068db76ba";
  const secondId = "2f087137-65df-4463-8fe2-eb4de88b7380";

  it("accepts distinct attachment ids", () => {
    expect(parseForwardAttachmentIds([firstId, secondId])).toEqual([firstId, secondId]);
  });

  it("rejects invalid or duplicated attachment ids", () => {
    expect(parseForwardAttachmentIds(["not-an-id"])).toBeNull();
    expect(parseForwardAttachmentIds([firstId, firstId])).toBeNull();
  });
});
