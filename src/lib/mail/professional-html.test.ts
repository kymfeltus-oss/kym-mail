import { describe, expect, it } from "vitest";
import { buildProfessionalEmailHtml, defaultEmailLookForSender, formatMessageHtml } from "./professional-html";

describe("professional outgoing email HTML", () => {
  it("turns the written message into paragraphs and lists without changing the words", () => {
    const html = formatMessageHtml("Hello Cameron,\n\nI can meet Thursday.\n\n- Review the packet\n- Confirm the time\n\nKym");
    expect(html).toContain("Hello Cameron,");
    expect(html).toContain("I can meet Thursday.");
    expect(html).toContain("<li");
    expect(html).toContain("Review the packet");
    expect(html).toContain("Kym");
  });

  it("uses the editorial look for the personal sender", () => {
    expect(defaultEmailLookForSender("kym@kymmailapp.com", "Personal / professional")).toBe("personal");
    const html = buildProfessionalEmailHtml({
      from: "kym@kymmailapp.com",
      subject: "Intro <script>",
      body: "Please ignore <script>alert(1)</script> and visit https://kymmailapp.com/consult"
    });
    expect(html).toContain("KYM");
    expect(html).toContain("Private correspondence");
    expect(html).toContain("Sent by kym@kymmailapp.com");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('href="https://kymmailapp.com/consult"');
  });

  it("uses company stationery for the business sender", () => {
    expect(defaultEmailLookForSender("info@kymmailapp.com", "General / business")).toBe("business");
    const html = buildProfessionalEmailHtml({
      from: "info@kymmailapp.com",
      subject: "Project update",
      body: "The packet is ready."
    });
    expect(html).toContain("KYM MAIL");
    expect(html).toContain("Company correspondence");
    expect(html).toContain("Sent by info@kymmailapp.com");
    expect(html).toContain("The packet is ready.");
  });
});
