function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function linkify(escaped: string, color: string, underline: string) {
  return escaped.replace(/https?:\/\/[^\s<]+/gi, (url) => {
    const href = url.replace(/[),.;:]+$/g, "");
    const trailing = url.slice(href.length);
    return `<a href="${href}" style="color:${color};text-decoration:none;border-bottom:1px solid ${underline}">${href}</a>${trailing}`;
  });
}

export const emailLooks = [
  { id: "personal", name: "Personal", description: "Private editorial stationery" },
  { id: "business", name: "KYM Mail", description: "Company stationery" }
] as const;

export type EmailLook = (typeof emailLooks)[number]["id"];

export function isEmailLook(value: unknown): value is EmailLook {
  return value === "personal" || value === "business";
}

export function defaultEmailLookForSender(from: string, label = "") {
  const email = from.trim().toLowerCase();
  if (email === "kym@kymmailapp.com") return "personal" as const;
  if (/\bpersonal\b/i.test(label)) return "personal" as const;
  return "business" as const;
}

const looks = {
  personal: {
    page: "#111111",
    card: "#F6F1E8",
    cardBorder: "#2A2A2A",
    masthead: "#0B0B0B",
    wordmark: "KYM",
    wordmarkStyle: "margin:0;color:#F6F1E8;font-family:Didot,'Bodoni MT',Georgia,'Times New Roman',serif;font-size:28px;font-weight:400;letter-spacing:.42em",
    kicker: "Private correspondence",
    kickerStyle: "margin:10px 0 0;color:#C4A574;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.38em;text-transform:uppercase",
    rule: "#C4A574",
    subjectStyle: "margin:0 0 28px;color:#0B0B0B;font-family:Didot,'Bodoni MT',Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;letter-spacing:.01em;line-height:1.35",
    body: "color:#1A1A1A;font-size:16px;line-height:1.75;font-family:Helvetica Neue,Helvetica,Arial,sans-serif",
    link: "#6B1D2A",
    linkLine: "#C4A574",
    footerBorder: "#D4CBB8",
    footerStyle: "margin:0;padding-top:20px;border-top:1px solid #D4CBB8;color:#6F675C;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.18em;text-transform:uppercase"
  },
  business: {
    page: "#E8EEF4",
    card: "#FFFFFF",
    cardBorder: "#C9D4E0",
    masthead: "#183A5A",
    wordmark: "KYM MAIL",
    wordmarkStyle: "margin:0;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;letter-spacing:.34em",
    kicker: "Company correspondence",
    kickerStyle: "margin:10px 0 0;color:#E7B8C1;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.28em;text-transform:uppercase",
    rule: "#D95B72",
    subjectStyle: "margin:0 0 24px;color:#183A5A;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;line-height:1.4",
    body: "color:#243447;font-size:16px;line-height:1.7;font-family:Helvetica Neue,Helvetica,Arial,sans-serif",
    link: "#A73D52",
    linkLine: "#D95B72",
    footerBorder: "#E8E2E3",
    footerStyle: "margin:0;padding-top:20px;border-top:1px solid #E8E2E3;color:#64748B;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.16em;text-transform:uppercase"
  }
} as const;

export function formatMessageHtml(body: string, look: EmailLook = "personal") {
  const theme = looks[look];
  const blocks = body.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  return blocks.map((block) => {
    const lines = block.split("\n").map((line) => line.trimEnd());
    const listItems = lines.filter((line) => line.trim());
    if (listItems.length > 1 && listItems.every((line) => /^[-*•]\s+\S/.test(line.trim()))) {
      return `<ul style="margin:0 0 22px;padding:0 0 0 18px">${listItems.map((line) => `<li style="margin:0 0 10px;${theme.body}">${linkify(escapeHtml(line.trim().replace(/^[-*•]\s+/, "")), theme.link, theme.linkLine)}</li>`).join("")}</ul>`;
    }
    return `<p style="margin:0 0 22px;${theme.body}">${lines.map((line) => linkify(escapeHtml(line), theme.link, theme.linkLine)).join("<br>")}</p>`;
  }).join("");
}

export function buildProfessionalEmailHtml({
  from,
  subject,
  body,
  look
}: {
  from: string;
  subject: string;
  body: string;
  look?: EmailLook;
}) {
  const theme = looks[look ?? defaultEmailLookForSender(from)];
  const content = formatMessageHtml(body, look ?? defaultEmailLookForSender(from)) || `<p style="margin:0;${theme.body}">${escapeHtml(body)}</p>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${theme.page}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${theme.page};padding:36px 12px">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:${theme.card};border:1px solid ${theme.cardBorder}">
        <tr>
          <td style="background:${theme.masthead};padding:28px 36px 22px;text-align:center">
            <p style="${theme.wordmarkStyle}">${theme.wordmark}</p>
            <p style="${theme.kickerStyle}">${theme.kicker}</p>
          </td>
        </tr>
        <tr><td style="height:1px;background:${theme.rule};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="padding:36px 36px 8px">
            <p style="${theme.subjectStyle}">${escapeHtml(subject)}</p>
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 36px 32px">
            <p style="${theme.footerStyle}">Sent by ${escapeHtml(from)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
