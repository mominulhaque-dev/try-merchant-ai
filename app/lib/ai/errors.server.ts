import { AppError, type ErrorCode } from "../errors";

/**
 * Normalize any provider/transport failure into a taxonomy {@link AppError}
 * (docs/40 error taxonomy, docs/16 fallback). Providers throw wildly different
 * shapes — Anthropic SDK error classes, raw `fetch` Response errors, `AbortError`
 * timeouts — so this is the single choke point that maps them to a stable,
 * user-safe code with a correct `retryable` classification. The {@link AIService}
 * relies on that classification to decide whether to fail over to the next tier.
 */

/** HTTP statuses the provider layer treats as safe to retry / fail over on. */
function codeForStatus(status: number): ErrorCode {
  if (status === 401 || status === 403) return "PROVIDER_UNAVAILABLE"; // our key, not the user's
  if (status === 408) return "TIMEOUT";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  if (status === 400 || status === 422) return "VALIDATION";
  return "PROVIDER_UNAVAILABLE";
}

/** Read a numeric HTTP status off the many error shapes providers throw. */
function extractStatus(err: unknown): number | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const e = err as Record<string, unknown>;
  for (const key of ["status", "statusCode"]) {
    const v = e[key];
    if (typeof v === "number") return v;
  }
  const response = e["response"];
  if (typeof response === "object" && response !== null) {
    const s = (response as Record<string, unknown>)["status"];
    if (typeof s === "number") return s;
  }
  return undefined;
}

function isAbort(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const name = (err as { name?: unknown }).name;
  return name === "AbortError" || name === "TimeoutError";
}

/**
 * Map a provider throwable to an {@link AppError}. Known AppErrors pass through
 * (stamped with the trace); everything else is classified by HTTP status or
 * abort signal, defaulting to a retryable PROVIDER_UNAVAILABLE so the service
 * fails over rather than surfacing a raw vendor error to the merchant.
 */
export function mapProviderError(
  err: unknown,
  ctx: { provider: string; traceId: string },
): AppError {
  if (AppError.is(err)) return AppError.from(err, ctx.traceId);

  if (isAbort(err)) {
    return new AppError("TIMEOUT", {
      message: "The AI provider took too long to respond.",
      traceId: ctx.traceId,
      details: { provider: ctx.provider },
      cause: err,
    });
  }

  const status = extractStatus(err);
  if (status !== undefined) {
    const code = codeForStatus(status);
    return new AppError(code, {
      traceId: ctx.traceId,
      details: { provider: ctx.provider, status },
      cause: err,
    });
  }

  // Unknown/transport failure (DNS, socket reset): treat as a provider outage so
  // the service fails over to the next tier (docs/16).
  return new AppError("PROVIDER_UNAVAILABLE", {
    traceId: ctx.traceId,
    details: { provider: ctx.provider },
    cause: err,
  });
}
