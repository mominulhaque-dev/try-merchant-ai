import { AppError, type ErrorEnvelope } from "../errors";

/**
 * Consistent JSON envelopes for internal API endpoints (docs/19
 * "JSON/stream endpoint contract"). Route `loader`/`action`s that return JSON
 * use these so success and error shapes are uniform across the app.
 *
 * `Response` is a Web/RR7 global — this module is UI-agnostic and safe to use
 * from any server route.
 */

export interface SuccessMeta {
  readonly traceId: string;
  /** ISO timestamp of the data's freshness where relevant (docs/14 "as of"). */
  readonly asOf?: string;
  readonly [key: string]: unknown;
}

export interface SuccessEnvelope<T> {
  readonly ok: true;
  readonly data: T;
  readonly meta: SuccessMeta;
}

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

/** Build a success envelope (not yet serialized). */
export function success<T>(data: T, meta: SuccessMeta): SuccessEnvelope<T> {
  return { ok: true, data, meta };
}

/** Serialize a success envelope to a JSON Response. */
export function jsonOk<T>(
  data: T,
  meta: SuccessMeta,
  init?: ResponseInit,
): Response {
  return new Response(JSON.stringify(success(data, meta)), {
    status: init?.status ?? 200,
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  });
}

/**
 * Serialize any thrown value to a JSON error Response using the AppError
 * taxonomy. Never leaks `cause`/stack to the client (docs/32, docs/40).
 */
export function jsonError(value: unknown, traceId: string): Response {
  const appError = AppError.from(value, traceId);
  const envelope: ErrorEnvelope = appError.toEnvelope(traceId);
  return new Response(JSON.stringify(envelope), {
    status: appError.httpStatus,
    headers: JSON_HEADERS,
  });
}
