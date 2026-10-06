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
  { id: "personal", name: "Personal", company: null, description: "KYM Mail stationery" },
  { id: "snaptax", name: "SnapTax", company: "SnapTax", description: "SnapTax stationery" },
  { id: "securafin", name: "SecuraFin-AI", company: "SecuraFin-AI", description: "SecuraFin-AI stationery" },
  { id: "parable", name: "PARABLE", company: "PARABLE", description: "PARABLE stationery" },
  { id: "mass", name: "MASS DEVELOPMENT GROUP", company: "MASS DEVELOPMENT GROUP", description: "MASS DEVELOPMENT GROUP stationery" }
] as const;

export type EmailLook = (typeof emailLooks)[number]["id"];

export const ownerSignature = {
  name: "Kym Feltus",
  phone: "470-736-1132"
} as const;

export function isEmailLook(value: unknown): value is EmailLook {
  return typeof value === "string" && emailLooks.some((look) => look.id === value);
}

export function defaultEmailLookForSender(from: string, label = "") {
  const email = from.trim().toLowerCase();
  if (email === "kym@kymmailapp.com" || /\bpersonal\b/i.test(label)) return "personal" as const;
  return "personal" as const;
}

const looks = {
  personal: {
    page: "#05070D",
    card: "#F4F7FB",
    cardBorder: "#1C283C",
    masthead: "#070D18",
    wordmark: "KYM MAIL",
    wordmarkStyle: "margin:0;color:#F4F7FB;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:.28em",
    kicker: "Your inbox. Your career. Your future.",
    kickerStyle: "margin:10px 0 0;color:#22D3EE;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.22em;text-transform:uppercase",
    rule: "#2563EB",
    subjectStyle: "margin:0 0 28px;color:#0B1220;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:.01em;line-height:1.35",
    body: "color:#1A2332;font-size:16px;line-height:1.75;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif",
    link: "#1D4ED8",
    linkLine: "#93C5FD",
    signName: "margin:0;color:#0B1220;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700",
    signMeta: "margin:6px 0 0;color:#52657A;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55",
    mastheadImage: "/brand/kym-mail-lockup.png"
  },
  snaptax: {
    page: "#F3F6F2",
    card: "#FFFFFF",
    cardBorder: "#C9D4C4",
    masthead: "#1B4D3E",
    wordmark: "SNAPTAX",
    wordmarkStyle: "margin:0;color:#F7F3E8;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:.28em",
    kicker: "Tax correspondence",
    kickerStyle: "margin:10px 0 0;color:#D4C08A;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.28em;text-transform:uppercase",
    rule: "#C4A574",
    subjectStyle: "margin:0 0 24px;color:#1B4D3E;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:400;line-height:1.4",
    body: "color:#24332C;font-size:16px;line-height:1.7;font-family:Helvetica Neue,Helvetica,Arial,sans-serif",
    link: "#1B4D3E",
    linkLine: "#C4A574",
    signName: "margin:0;color:#1B4D3E;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700",
    signMeta: "margin:6px 0 0;color:#5C6B63;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55"
  },
  securafin: {
    page: "#0E1418",
    card: "#F4F7F8",
    cardBorder: "#1F2A30",
    masthead: "#0B1216",
    wordmark: "SECURAFIN-AI",
    wordmarkStyle: "margin:0;color:#E8F4F4;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;letter-spacing:.26em",
    kicker: "Secure correspondence",
    kickerStyle: "margin:10px 0 0;color:#7ED4C8;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.28em;text-transform:uppercase",
    rule: "#2EC4B6",
    subjectStyle: "margin:0 0 24px;color:#0B1216;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:20px;font-weight:500;line-height:1.4",
    body: "color:#1C262C;font-size:16px;line-height:1.7;font-family:Helvetica Neue,Helvetica,Arial,sans-serif",
    link: "#0F6E67",
    linkLine: "#2EC4B6",
    signName: "margin:0;color:#0B1216;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:16px;font-weight:700",
    signMeta: "margin:6px 0 0;color:#5A6A72;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55"
  },
  parable: {
    page: "#2A1418",
    card: "#F8F1E6",
    cardBorder: "#4A2A30",
    masthead: "#4A1520",
    wordmark: "PARABLE",
    wordmarkStyle: "margin:0;color:#F8F1E6;font-family:Didot,'Bodoni MT',Georgia,'Times New Roman',serif;font-size:30px;font-weight:400;letter-spacing:.34em",
    kicker: "Studio correspondence",
    kickerStyle: "margin:10px 0 0;color:#E3C6A0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;font-size:10px;letter-spacing:.32em;text-transform:uppercase",
    rule: "#C4A574",
    subjectStyle: "margin:0 0 28px;color:#4A1520;font-family:Didot,'Bodoni MT',Georgia,'Times New Roman',serif;font-size:22px;font-weight:400;line-height:1.35",
    body: "color:#2A1A16;font-size:16px;line-height:1.75;font-family:Georgia,'Times New Roman',serif",
    link: "#7A2433",
    linkLine: "#C4A574",
    signName: "margin:0;color:#4A1520;font-family:Didot,'Bodoni MT',Georgia,'Times New Roman',serif;font-size:18px",
    signMeta: "margin:6px 0 0;color:#7A6458;font-family:Georgia,'Times New Roman',serif;font-size:13px;line-height:1.55"
  },
  mass: {
    page: "#030B16",
    card: "#071423",
    cardBorder: "#184C7B",
    masthead: "#030B16",
    wordmark: "MASS DEVELOPMENT GROUP",
    wordmarkStyle: "margin:0;color:#F3F8FE;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.28em",
    productHtml: `<p style="margin:14px 0 0;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:28px;font-weight:700;letter-spacing:-.03em;line-height:1"><span style="color:#F3F8FE">Data</span><span style="color:#00B0F8">Merge</span></p>`,
    kicker: "Unify. Transform. Deliver.",
    kickerStyle: "margin:12px 0 0;color:#E8B848;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:10px;font-weight:600;letter-spacing:.28em;text-transform:uppercase",
    rule: "#E8B848",
    subjectStyle: "margin:0 0 24px;color:#F3F8FE;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:600;letter-spacing:.01em;line-height:1.35",
    body: "color:#F3F8FE;font-size:16px;line-height:1.7;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif",
    link: "#00B0F8",
    linkLine: "#00B0F8",
    signName: "margin:0;color:#F3F8FE;font-family:Montserrat,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:16px;font-weight:700",
    signMeta: "margin:6px 0 0;color:#B7C4D4;font-family:Inter,'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.55"
  }
} as const;

function signatureHtml(from: string, look: EmailLook) {
  const theme = looks[look];
  const company = emailLooks.find((item) => item.id === look)?.company;
  const email = escapeHtml(from);
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px">
  <tr>
    <td style="padding-top:20px;border-top:1px solid ${theme.rule}">
      <p style="${theme.signName}">${escapeHtml(ownerSignature.name)}</p>
      ${company ? `<p style="${theme.signMeta}">${escapeHtml(company)}</p>` : ""}
      <p style="${theme.signMeta}"><a href="mailto:${email}" style="color:${theme.link};text-decoration:none">${email}</a></p>
      <p style="${theme.signMeta}">${escapeHtml(ownerSignature.phone)}</p>
    </td>
  </tr>
</table>`;
}

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
  const selected = look ?? defaultEmailLookForSender(from);
  const theme = looks[selected];
  const content = formatMessageHtml(body, selected) || `<p style="margin:0;${theme.body}">${escapeHtml(body)}</p>`;
  const logoPath = "mastheadImage" in theme ? theme.mastheadImage : "";
  const logoBase = process.env.APP_URL?.trim().replace(/\/$/, "") ?? "";
  const logo = logoPath ? `<img src="${logoBase}${logoPath}" alt="KYM MAIL" width="220" style="display:block;margin:0 auto 16px;height:auto;border:0" />` : "";
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
            ${logo}
            <p style="${theme.wordmarkStyle}">${theme.wordmark}</p>
            ${"productHtml" in theme ? theme.productHtml : ""}
            <p style="${theme.kickerStyle}">${theme.kicker}</p>
          </td>
        </tr>
        <tr><td style="height:1px;background:${theme.rule};font-size:0;line-height:0">&nbsp;</td></tr>
        <tr>
          <td style="padding:36px 36px 8px">
            <p style="${theme.subjectStyle}">${escapeHtml(subject)}</p>
            ${content}
            ${signatureHtml(from, selected)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function emailLookChrome(look: EmailLook) {
  const theme = looks[look];
  return { page: theme.page, masthead: theme.masthead, accent: theme.rule };
}
