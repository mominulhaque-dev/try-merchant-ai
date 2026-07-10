/**
 * Canonical error taxonomy for TryMerchantAI.
 *
 * Source of truth: docs/19_API_ARCHITECTURE.md ("Errors") and
 * docs/40_ERROR_HANDLING.md ("Error taxonomy"). Every error surfaced by a
 * route, job, tool, or service maps to one of these codes so clients and logs
 * see a consistent, user-safe shape.
 */

export type ErrorCode =
  | "UNAUTHENTICATED" // no/invalid session token or offline token
  | "FORBIDDEN" // authenticated but role/authz denies the action
  | "SCOPE_MISSING" // required Shopify access scope not granted
  | "PLAN_REQUIRED" // feature gated behind a higher plan (billing)
  | "BUDGET_EXCEEDED" // AAC / token / cost budget reached
  | "RATE_LIMITED" // our own per-shop rate limit
  | "THROTTLED_SHOPIFY" // Shopify GraphQL cost throttle
  | "VALIDATION" // input failed schema / business validation
  | "CONFLICT" // optimistic-concurrency / stale-state conflict
  | "NOT_FOUND" // resource does not exist (within tenant)
  | "PROVIDER_UNAVAILABLE" // AI model provider outage / failover exhausted
  | "TIMEOUT" // an upstream call exceeded its deadline
  | "INTERNAL"; // unexpected / unhandled

export interface ErrorCodeMeta {
  /** HTTP status used when this error is returned from an endpoint. */
  readonly httpStatus: number;
  /** Whether the caller may safely retry the same operation. */
  readonly retryable: boolean;
  /**
   * Default user-facing message. MUST be safe to show a merchant: no stack
   * traces, no internal identifiers, no PII (docs/32, docs/41).
   */
  readonly defaultMessage: string;
}

export const ERROR_CODES: Record<ErrorCode, ErrorCodeMeta> = {
  UNAUTHENTICATED: {
    httpStatus: 401,
    retryable: false,
    defaultMessage: "Your session has expired. Please reload the app.",
  },
  FORBIDDEN: {
    httpStatus: 403,
    retryable: false,
    defaultMessage: "You don't have permission to perform this action.",
  },
  SCOPE_MISSING: {
    httpStatus: 403,
    retryable: false,
    defaultMessage:
      "This feature needs an additional permission. Please grant access to continue.",
  },
  PLAN_REQUIRED: {
    httpStatus: 402,
    retryable: false,
    defaultMessage: "This feature is available on a higher plan.",
  },
  BUDGET_EXCEEDED: {
    httpStatus: 429,
    retryable: false,
    defaultMessage:
      "You've reached your usage limit for this period. Upgrade or add credits to continue.",
  },
  RATE_LIMITED: {
    httpStatus: 429,
    retryable: true,
    defaultMessage: "Too many requests. Please try again shortly.",
  },
  THROTTLED_SHOPIFY: {
    httpStatus: 503,
    retryable: true,
    defaultMessage: "Shopify is rate-limiting requests. We'll retry automatically.",
  },
  VALIDATION: {
    httpStatus: 422,
    retryable: false,
    defaultMessage: "Some of the information provided isn't valid.",
  },
  CONFLICT: {
    httpStatus: 409,
    retryable: true,
    defaultMessage:
      "This item changed since you last loaded it. Please review and try again.",
  },
  NOT_FOUND: {
    httpStatus: 404,
    retryable: false,
    defaultMessage: "We couldn't find what you were looking for.",
  },
  PROVIDER_UNAVAILABLE: {
    httpStatus: 503,
    retryable: true,
    defaultMessage:
      "The AI service is temporarily unavailable. Recommendations may be limited.",
  },
  TIMEOUT: {
    httpStatus: 504,
    retryable: true,
    defaultMessage: "That took too long. Please try again.",
  },
  INTERNAL: {
    httpStatus: 500,
    retryable: false,
    defaultMessage: "Something went wrong on our end. We've been notified.",
  },
};

/** Codes that are "expected" business outcomes rather than defects. */
export function isRetryable(code: ErrorCode): boolean {
  return ERROR_CODES[code].retryable;
}
