import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getOwnerContext } from "@/lib/auth/owner-context";
import { ProviderUnavailableError, toSafeError, ValidationError } from "@/lib/errors";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_DRIVE_FILE_BYTES = 5 * 1024 ** 4;
const requestSchema = z.object({
  sessionUrl: z.string().url().max(2048),
  size: z.number().int().positive().max(MAX_DRIVE_FILE_BYTES)
});

function isDriveUploadSessionUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === "https://www.googleapis.com"
      && !url.username
      && !url.password
      && url.pathname === "/upload/drive/v3/files"
      && url.searchParams.get("uploadType") === "resumable"
      && Boolean(url.searchParams.get("upload_id"));
  } catch {
    return false;
  }
}

function noStoreHeaders() {
  return { "cache-control": "no-store, max-age=0" };
}

export async function POST(request: NextRequest) {
  const owner = await getOwnerContext();
  if (!owner) return NextResponse.json({ error: "Please sign in to continue." }, { status: 401, headers: noStoreHeaders() });
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403, headers: noStoreHeaders() });

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success || !isDriveUploadSessionUrl(parsed.data.sessionUrl)) {
      throw new ValidationError("The Google Drive upload session is invalid. Select the file again to restart.");
    }

    let response: Response;
    try {
      response = await fetch(parsed.data.sessionUrl, {
        method: "PUT",
        headers: { "content-range": `bytes */${parsed.data.size}` },
        redirect: "manual",
        cache: "no-store",
        signal: AbortSignal.timeout(30_000)
      });
    } catch (error) {
      log("error", "mail.google_drive_upload_progress_unavailable", { reason: error instanceof Error ? error.name : "unknown" });
      throw new ProviderUnavailableError("Could not check Google Drive upload progress. Retry in a moment.");
    }

    if (response.status === 308) {
      const match = response.headers.get("range")?.match(/^bytes=0-(\d+)$/i);
      const offset = match ? Math.min(Number(match[1]) + 1, parsed.data.size) : 0;
      return NextResponse.json({ offset }, { headers: noStoreHeaders() });
    }

    if (response.status === 200 || response.status === 201) {
      const file = await response.json().catch(() => null) as { id?: unknown } | null;
      if (typeof file?.id !== "string" || !file.id) {
        throw new ProviderUnavailableError("Google Drive could not confirm the completed upload. Retry the file upload.");
      }
      return NextResponse.json({ offset: parsed.data.size, fileId: file.id }, { headers: noStoreHeaders() });
    }

    if (response.status === 404 || response.status === 410) {
      return NextResponse.json(
        { error: "This Google Drive upload session expired. Remove the file and select it again to restart.", expired: true },
        { status: 410, headers: noStoreHeaders() }
      );
    }

    log("error", "mail.google_drive_upload_progress_failed", { status: response.status });
    throw new ProviderUnavailableError("Google Drive could not confirm the upload. Retry the file upload.");
  } catch (error) {
    const safeError = toSafeError(error);
    const status = safeError.code === "VALIDATION" ? 400 : safeError.code === "UNAUTHORIZED" ? 401 : 503;
    return NextResponse.json({ error: safeError.safeMessage }, { status, headers: noStoreHeaders() });
  }
}
