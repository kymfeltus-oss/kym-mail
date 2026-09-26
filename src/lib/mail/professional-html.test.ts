import { describe, expect, it } from "vitest";
import { buildProfessionalEmailHtml, defaultEmailLookForSender, emailLooks, formatMessageHtml } from "./professional-html";

describe("professional outgoing email HTML", () => {
  it("turns the written message into paragraphs and lists without changing the words", () => {
    const html = formatMessageHtml("Hello Cameron,\n\nI can meet Thursday.\n\n- Review the packet\n- Confirm the time\n\nKym");
    expect(html).toContain("Hello Cameron,");
    expect(html).toContain("I can meet Thursday.");
    expect(html).toContain("<li");
    expect(html).toContain("Review the packet");
    expect(html).toContain("Kym");
  });

  it("uses the editorial look and signature for personal stationery", () => {
    expect(defaultEmailLookForSender("kym@kymmailapp.com", "Personal / professional")).toBe("personal");
    const html = buildProfessionalEmailHtml({
      from: "kym@kymmailapp.com",
      subject: "Intro <script>",
      body: "Please ignore <script>alert(1)</script> and visit https://kymmailapp.com/consult"
    });
    expect(html).toContain("KYM");
    expect(html).toContain("Private correspondence");
    expect(html).toContain("Kym Feltus");
    expect(html).toContain("470-736-1132");
    expect(html).toContain("mailto:kym@kymmailapp.com");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('href="https://kymmailapp.com/consult"');
  });

  it("renders each company look with the matching masthead and signature", () => {
    const companies = [
      { look: "snaptax" as const, wordmark: "SNAPTAX", company: "SnapTax" },
      { look: "securafin" as const, wordmark: "SECURAFIN-AI", company: "SecuraFin-AI" },
      { look: "parable" as const, wordmark: "PARABLE", company: "PARABLE" },
      { look: "mass" as const, wordmark: "MASS DEVELOPMENT GROUP", company: "MASS DEVELOPMENT GROUP" }
    ];
    for (const company of companies) {
      const html = buildProfessionalEmailHtml({
        from: "info@kymmailapp.com",
        subject: "Project update",
        body: "The packet is ready.",
        look: company.look
      });
      expect(html).toContain(company.wordmark);
      expect(html).toContain(company.company);
      expect(html).toContain("Kym Feltus");
      expect(html).toContain("470-736-1132");
      expect(html).toContain("The packet is ready.");
    }
    expect(emailLooks.map((look) => look.id)).toEqual(["personal", "snaptax", "securafin", "parable", "mass"]);
  });
});
