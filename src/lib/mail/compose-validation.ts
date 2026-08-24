import { z } from "zod";

const email = z.string().trim().toLowerCase().email().max(254);

export function parseRecipientList(value: string) {
  const entries = value.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
  const result = z.array(email).max(100).safeParse(entries);
  return result.success ? [...new Set(result.data)] : null;
}

export const composeInputSchema = z.object({
  from: email,
  to: z.string().max(25_500),
  cc: z.string().max(25_500).default(""),
  bcc: z.string().max(25_500).default(""),
  subject: z.string().trim().min(1).max(200).refine((value) => !/[\r\n]/.test(value)),
  body: z.string().trim().min(1).max(500_000),
  providerThreadId: z.string().trim().max(200).optional(),
  replyToMessageId: z.string().trim().max(998).refine((value) => !/[\r\n]/.test(value)).optional()
});

export function validateComposeInput(input: unknown) {
  const parsed = composeInputSchema.safeParse(input);
  if (!parsed.success) return null;
  const to = parseRecipientList(parsed.data.to);
  const cc = parseRecipientList(parsed.data.cc);
  const bcc = parseRecipientList(parsed.data.bcc);
  if (!to?.length || cc === null || bcc === null) return null;
  return { ...parsed.data, to, cc, bcc };
}

export const blockedAttachmentPattern = /\.(?:ade|adp|apk|appx|appxbundle|bat|cab|chm|cmd|com|cpl|dll|dmg|exe|hta|ins|iso|isp|jar|js|jse|lib|lnk|mde|msc|msi|msix|msp|mst|nsh|pif|ps1|scr|sct|shb|sys|vb|vbe|vbs|vxd|wsc|wsf|wsh)$/i;

