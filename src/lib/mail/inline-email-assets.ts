import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { MailInlineImageInput } from "@/domain/providers/mail-provider";
import { emailLogoAssetForLook, type EmailLook } from "@/lib/mail/professional-html";

/** Loads a brand masthead as a CID image so recipients do not depend on a public app URL. */
export async function loadInlineEmailLogo(look: EmailLook): Promise<MailInlineImageInput[]> {
  const asset = emailLogoAssetForLook(look);
  if (!asset) return [];

  const pathSegments = asset.path.split("/").filter(Boolean);
  let content: Uint8Array;
  try {
    content = new Uint8Array(await readFile(join(process.cwd(), "public", ...pathSegments)));
  } catch (readError) {
    const publicBaseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    if (!publicBaseUrl) throw readError;
    const response = await fetch(new URL(asset.path, publicBaseUrl));
    if (!response.ok) throw readError;
    content = new Uint8Array(await response.arrayBuffer());
  }
  return [{
    contentId: asset.contentId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    content
  }];
}
