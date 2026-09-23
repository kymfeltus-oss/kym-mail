import { AppError } from "@/lib/errors";

const quotaStatuses = new Set(["RESOURCE_EXHAUSTED", "RATE_LIMIT_EXCEEDED"]);
const staleHistoryStatuses = new Set(["NOT_FOUND", "FAILED_PRECONDITION", "INVALID_ARGUMENT"]);

export function googleMailFailure(status: number, providerStatus?: string | null) {
  const normalizedStatus = providerStatus?.trim() || null;
  const exhausted = status === 429 || (normalizedStatus !== null && quotaStatuses.has(normalizedStatus));
  const staleHistory = status === 404 || status === 410 || (status === 400 && (normalizedStatus === null || staleHistoryStatuses.has(normalizedStatus)));
  const forbidden = status === 403 && !exhausted;
  let safeMessage = "Google Mail is temporarily unavailable.";
  if (exhausted) safeMessage = "Gmail is busy. Wait a moment, then sync again.";
  else if (forbidden) safeMessage = "Gmail refused this request. Reconnect Google Mail to restore access.";
  return { exhausted, staleHistory, forbidden, safeMessage, status, providerStatus: normalizedStatus };
}

export function providerStatus(error: unknown) {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== "object") return null;
  const status = (error.details as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function providerStatusName(error: unknown) {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== "object") return null;
  const status = (error.details as { providerStatus?: unknown }).providerStatus;
  return typeof status === "string" && status.trim() ? status.trim() : null;
}

export function providerRequestPath(error: unknown) {
  if (!(error instanceof AppError) || !error.details || typeof error.details !== "object") return null;
  const path = (error.details as { path?: unknown }).path;
  return typeof path === "string" && path.startsWith("/") ? path : null;
}

export function isRecoverableGmailHistoryError(error: unknown) {
  const status = providerStatus(error);
  if (status == null) return false;
  const path = providerRequestPath(error);
  if (path === "/history" && (status === 403 || status === 400 || status === 404 || status === 410)) return true;
  return googleMailFailure(status, providerStatusName(error)).staleHistory;
}
