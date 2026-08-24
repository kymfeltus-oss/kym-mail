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

export function toSafeError(error: unknown): Pick<AppError, "code" | "safeMessage"> {
  return error instanceof AppError ? { code: error.code, safeMessage: error.safeMessage } : { code: "INTERNAL", safeMessage: "Something went wrong. Please try again." };
}
