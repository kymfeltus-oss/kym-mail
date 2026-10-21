import { z } from "zod";
import type { GoogleMailProvider } from "@/integrations/google/google-mail-provider";
import { MAX_ATTACHMENT_COUNT } from "@/lib/mail/attachment-validation";
import { ValidationError } from "@/lib/errors";

const driveFileIdsSchema = z.array(z.string().min(10).max(200).regex(/^[a-zA-Z0-9_-]+$/)).max(MAX_ATTACHMENT_COUNT);

export function parseDriveFileIds(value: FormDataEntryValue | null) {
  if (value === null || value === "") return [];
  if (typeof value !== "string") return null;
  try {
    const parsed = driveFileIdsSchema.safeParse(JSON.parse(value));
    if (!parsed.success || new Set(parsed.data).size !== parsed.data.length) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export type SharedDriveFile = { id: string; name: string; url: string };

export async function shareDriveFilesForEmail(provider: GoogleMailProvider, ownerId: string, connectionId: string, fileIds: string[]): Promise<SharedDriveFile[]> {
  const shared: SharedDriveFile[] = [];
  for (const fileId of fileIds) {
    const file = await provider.getDriveFile(fileId);
    if (file.appProperties?.kymMailOwner !== ownerId
      || file.appProperties?.kymMailConnection !== connectionId
      || file.appProperties?.kymMailPurpose !== "email-link-attachment") {
      throw new ValidationError("A large-file link is unavailable for the selected sender. Remove it and upload it again.");
    }
    await provider.shareDriveFileWithAnyone(fileId);
    shared.push({ id: file.id, name: file.name, url: `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view` });
  }
  return shared;
}

export function appendDriveLinkSection(body: string, files: SharedDriveFile[]) {
  if (!files.length) return body;
  const links = files.map((file) => `- ${file.name}\n  ${file.url}`).join("\n");
  return `${body.trim()}\n\nFiles shared through Google Drive (anyone with the link can view):\n${links}`;
}

