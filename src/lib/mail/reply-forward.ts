export type ReplyForwardMessage = {
  fromAddress: string;
  toAddresses: string[];
  ccAddresses: string[];
  subject: string;
  textBody: string | null;
};

function prefixedSubject(subject: string, prefix: "Re" | "Fwd", existingPrefix: RegExp) {
  const normalized = subject.trim() || "(no subject)";
  return existingPrefix.test(normalized) ? normalized : `${prefix}: ${normalized}`;
}

export function replySubject(subject: string) {
  return prefixedSubject(subject, "Re", /^\s*re\s*:/i);
}

export function forwardSubject(subject: string) {
  return prefixedSubject(subject, "Fwd", /^\s*(?:fwd?|fw)\s*:/i);
}

export function replyRecipient(message: Pick<ReplyForwardMessage, "fromAddress" | "toAddresses" | "ccAddresses">, identityEmails: string[]) {
  const ownAddresses = new Set(identityEmails.map((email) => email.toLowerCase()));
  if (!ownAddresses.has(message.fromAddress.toLowerCase())) return message.fromAddress;
  return [...message.toAddresses, ...message.ccAddresses].find((email) => !ownAddresses.has(email.toLowerCase())) ?? "";
}

export function forwardBody(message: ReplyForwardMessage, sentAtLabel: string) {
  const headerLines = [
    "---------- Forwarded message ----------",
    `From: ${message.fromAddress}`,
    `Date: ${sentAtLabel}`,
    `Subject: ${message.subject}`,
    `To: ${message.toAddresses.join(", ") || "Undisclosed recipient"}`,
    ...(message.ccAddresses.length ? [`Cc: ${message.ccAddresses.join(", ")}`] : [])
  ];
  const body = message.textBody?.trim() || "(This message has no plain-text body.)";
  return `${headerLines.join("\n")}\n\n${body}`.slice(0, 500_000);
}
