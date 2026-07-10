import { AppError } from "./app-error";

/**
 * A typed success/failure result used by domain services and the action
 * pipeline (docs/20, docs/40) where throwing is undesirable and callers must
 * handle both branches explicitly.
 */
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Narrowing helpers. */
export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } =>
  r.ok;
export const isErr = <T, E>(r: Result<T, E>): r is { ok: false; error: E } =>
  !r.ok;

/**
 * Run a throwing function and capture the outcome as a Result, normalizing any
 * thrown value into an AppError (docs/40). Use at boundaries between throwing
 * code and Result-based code.
 */
export async function tryCatch<T>(
  fn: () => Promise<T> | T,
  traceId?: string,
): Promise<Result<T, AppError>> {
  try {
    return ok(await fn());
  } catch (error) {
    return err(AppError.from(error, traceId));
  }
}

/** Unwrap a successful Result or throw its AppError. */
export function unwrap<T>(r: Result<T, AppError>): T {
  if (r.ok) return r.value;
  throw r.error;
}
