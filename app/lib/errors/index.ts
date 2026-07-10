/**
 * Error handling primitives for TryMerchantAI (docs/19, docs/40).
 * Import from here rather than the individual files.
 */
export { ERROR_CODES, isRetryable, type ErrorCode, type ErrorCodeMeta } from "./codes";
export {
  AppError,
  errors,
  type AppErrorOptions,
  type ErrorDetails,
  type ErrorEnvelope,
} from "./app-error";
export {
  ok,
  err,
  isOk,
  isErr,
  tryCatch,
  unwrap,
  type Result,
} from "./result";
