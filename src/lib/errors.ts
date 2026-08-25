export const errorCodes = ["VALIDATION", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "PROVIDER_UNAVAILABLE", "CONFIGURATION", "INTERNAL"] as const;
export type ErrorCode = (typeof errorCodes)[number];

export class AppError extends Error {
  constructor(public readonly code: ErrorCode, public readonly safeMessage: string, public readonly details?: unknown, options?: ErrorOptions) {
    super(safeMessage, options); this.name = "AppError";
  }
}
export class ValidationError extends AppError { constructor(message = "The submitted information is invalid.", details?: unknown) { super("VALIDATION", message, details); } }
export class UnauthorizedError extends AppError { constructor(message = "Please sign in to continue.") { super("UNAUTHORIZED", message); } }
export class ConfigurationError extends AppError { constructor(message = "The application is not configured.", details?: unknown) { super("CONFIGURATION", message, details); } }
export class ProviderUnavailableError extends AppError { constructor(message = "The provider is temporarily unavailable. Please try again.", details?: unknown) { super("PROVIDER_UNAVAILABLE", message, details); } }
export class NotFoundError extends AppError { constructor(message = "The requested record was not found.") { super("NOT_FOUND", message); } }
export class ConflictError extends AppError { constructor(message = "The requested change conflicts with the current state.") { super("CONFLICT", message); } }

export function toSafeError(error: unknown): Pick<AppError, "code" | "safeMessage"> {
  return error instanceof AppError ? { code: error.code, safeMessage: error.safeMessage } : { code: "INTERNAL", safeMessage: "Something went wrong. Please try again." };
}
