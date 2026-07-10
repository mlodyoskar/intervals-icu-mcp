export type AppErrorCode =
  | "INVALID_CONFIGURATION"
  | "INVALID_CURSOR"
  | "INVALID_DATE"
  | "INVALID_DATE_RANGE"
  | "PLAN_CHANGED"
  | "PLAN_CONFLICT"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "UPSTREAM_UNAVAILABLE";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    public readonly safeMessage: string,
    options?: ErrorOptions,
  ) {
    super(safeMessage, options);
    this.name = "AppError";
  }
}

export function safeAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(
    "UPSTREAM_UNAVAILABLE",
    "The operation failed; no sensitive upstream details were exposed",
    error instanceof Error ? { cause: error } : undefined,
  );
}
