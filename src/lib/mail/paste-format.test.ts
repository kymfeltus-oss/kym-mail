import { describe, expect, it } from "vitest";
import { formatPastedEmail, formatPlainEmail } from "@/lib/mail/paste-format";

describe("pasted email formatting", () => {
  it("turns hard-wrapped sentences into separate paragraphs", () => {
    const pasted = "Hi Dana,\nI wanted to follow up on the close.\nThe files are ready whenever you are.\n\n- First batch\n- Second batch";
    expect(formatPlainEmail(pasted)).toBe("Hi Dana,\n\nI wanted to follow up on the close.\n\nThe files are ready whenever you are.\n\n- First batch\n- Second batch");
  });

  it("joins a wrapped line and keeps HTML paragraphs apart", () => {
    const plain = "This sentence was wrapped by the\neditor and should stay one paragraph.";
    expect(formatPlainEmail(plain)).toBe("This sentence was wrapped by the editor and should stay one paragraph.");
    expect(formatPastedEmail("", "<p>Hello Dana,</p><p>The reconciliation is ready.</p><ul><li>January</li><li>February</li></ul>")).toBe("Hello Dana,\n\nThe reconciliation is ready.\n\n- January\n- February");
  });
});
