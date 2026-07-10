import { ERROR_CODES, type ErrorCode } from "./codes";

/**
 * Structured, non-PII context attached to an error. Values here MAY appear in
 * logs and (when safe) in API error envelopes, so callers MUST NOT place raw
 * PII or secrets in `details` (docs/32, docs/41).
 */
export type ErrorDetails = Record<string, unknown>;

export interface AppErrorOptions {
  /** User-safe message override. Falls back to the code's default message. */
  readonly message?: string;
  /** Override the code's default `retryable` classification. */
  readonly retryable?: boolean;
  /** Safe, structured context for debugging (no PII/secrets). */
  readonly details?: ErrorDetails;
  /** Underlying cause, preserved for logging (never sent to clients). */
  readonly cause?: unknown;
  /** Correlation id (docs/39). */
  readonly traceId?: string;
}

/** Shape returned to API clients (docs/19 "Errors"). */
export interface ErrorEnvelope {
  readonly ok: false;
  readonly error: {
    readonly code: ErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly details?: ErrorDetails;
  };
  readonly meta: { readonly traceId: string };
}

/**
 * The single error type used across TryMerchantAI. Construct it with a code
 * from the taxonomy; unknown/unexpected throwables are wrapped as INTERNAL via
 * {@link AppError.from}. The `message` is always safe to show a merchant.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly retryable: boolean;
  readonly details?: ErrorDetails;
  readonly traceId?: string;
  /** Marks errors we constructed deliberately (vs. an unexpected throw). */
  readonly expected = true;

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const meta = ERROR_CODES[code];
    super(options.message ?? meta.defaultMessage, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = meta.httpStatus;
    this.retryable = options.retryable ?? meta.retryable;
    this.details = options.details;
    this.traceId = options.traceId;
    // Preserve prototype chain when targeting ES2022/down-level transpile.
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /** Type guard for narrowing an unknown throwable. */
  static is(value: unknown): value is AppError {
    return value instanceof AppError;
  }

  /**
   * Normalize any thrown value into an AppError. Known AppErrors are returned
   * as-is (optionally stamped with a traceId); everything else becomes an
   * INTERNAL error that preserves the original as `cause` for logging.
   */
  static from(value: unknown, traceId?: string): AppError {
    if (AppError.is(value)) {
      return traceId && !value.traceId
        ? new AppError(value.code, {
            message: value.message,
            retryable: value.retryable,
            details: value.details,
            cause: value.cause,
            traceId,
          })
        : value;
    }
    return new AppError("INTERNAL", { cause: value, traceId });
  }

  /** Serialize to the client-facing envelope (docs/19). Never leaks `cause`. */
  toEnvelope(traceId?: string): ErrorEnvelope {
    const resolvedTrace = traceId ?? this.traceId ?? "unknown";
    return {
      ok: false,
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.details ? { details: this.details } : {}),
      },
      meta: { traceId: resolvedTrace },
    };
  }
}

/** Convenience constructors for the most common codes. */
export const errors = {
  unauthenticated: (o?: AppErrorOptions) => new AppError("UNAUTHENTICATED", o),
  forbidden: (o?: AppErrorOptions) => new AppError("FORBIDDEN", o),
  scopeMissing: (o?: AppErrorOptions) => new AppError("SCOPE_MISSING", o),
  planRequired: (o?: AppErrorOptions) => new AppError("PLAN_REQUIRED", o),
  budgetExceeded: (o?: AppErrorOptions) => new AppError("BUDGET_EXCEEDED", o),
  rateLimited: (o?: AppErrorOptions) => new AppError("RATE_LIMITED", o),
  validation: (o?: AppErrorOptions) => new AppError("VALIDATION", o),
  conflict: (o?: AppErrorOptions) => new AppError("CONFLICT", o),
  notFound: (o?: AppErrorOptions) => new AppError("NOT_FOUND", o),
  providerUnavailable: (o?: AppErrorOptions) =>
    new AppError("PROVIDER_UNAVAILABLE", o),
  internal: (o?: AppErrorOptions) => new AppError("INTERNAL", o),
} as const;
