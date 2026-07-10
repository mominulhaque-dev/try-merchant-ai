import { AppError } from "../errors";

/**
 * Structured JSON logging (docs/41).
 *
 * Guarantees:
 *  - Emits one JSON object per line with a `traceId` for correlation (docs/39).
 *  - Scrubs secrets + PII via a key deny-list and email masking before output
 *    (docs/41 "No PII/secrets rule", docs/32). This is defense-in-depth: callers
 *    should already avoid logging sensitive values.
 *  - Never throws and never blocks the request path — logging failures are
 *    swallowed so they cannot take down a handler.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Context bound to a logger; merged into every line it writes. */
export interface LogFields {
  readonly traceId?: string;
  readonly shop?: string;
  readonly [key: string]: unknown;
}

/**
 * Substrings that, when present in a normalized key, cause the value to be
 * redacted entirely. Normalization strips non-alphanumerics and lowercases,
 * so `access_token`, `accessToken`, and `ACCESS-TOKEN` all match `accesstoken`.
 */
const REDACT_KEY_PARTS = [
  "password",
  "passwd",
  "secret",
  "token",
  "accesstoken",
  "refreshtoken",
  "apikey",
  "authorization",
  "auth",
  "cookie",
  "setcookie",
  "clientsecret",
  "sessiontoken",
  "hmac",
  "signature",
  "creditcard",
  "cardnumber",
  "cvv",
  "ssn",
];

const REDACTED = "[REDACTED]";
const MAX_DEPTH = 6;
const MAX_ARRAY = 50;
const EMAIL_RE = /([a-z0-9._%+-])[a-z0-9._%+-]*(@[a-z0-9.-]+\.[a-z]{2,})/gi;

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function shouldRedactKey(key: string): boolean {
  const n = normalizeKey(key);
  return REDACT_KEY_PARTS.some((part) => n.includes(part));
}

function maskEmails(value: string): string {
  return value.replace(EMAIL_RE, (_m, first: string, domain: string) => `${first}***${domain}`);
}

/** Recursively scrub a value: redact sensitive keys, mask emails, cap size. */
function scrub(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return maskEmails(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;

  if (depth >= MAX_DEPTH) return "[Truncated]";

  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => scrub(v, depth + 1, seen));
    if (value.length > MAX_ARRAY) out.push(`…(${value.length - MAX_ARRAY} more)`);
    return out;
  }

  if (typeof value === "object") {
    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = shouldRedactKey(k) ? REDACTED : scrub(v, depth + 1, seen);
    }
    return out;
  }

  return String(value);
}

/** Serialize an error for logging without leaking stacks in production. */
function serializeError(err: unknown, isProd: boolean): Record<string, unknown> {
  const appError = AppError.from(err);
  return {
    code: appError.code,
    message: appError.message,
    retryable: appError.retryable,
    ...(appError.details ? { details: scrub(appError.details) } : {}),
    ...(isProd ? {} : { stack: appError.stack }),
  };
}

function resolveMinLevel(): LogLevel {
  const fromEnv = (process.env.LOG_LEVEL ?? "").toLowerCase();
  if (fromEnv in LEVEL_ORDER) return fromEnv as LogLevel;
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const IS_PROD = process.env.NODE_ENV === "production";
const MIN_LEVEL = resolveMinLevel();

const CONSOLE: Record<LogLevel, (msg: string) => void> = {
  debug: (m) => console.debug(m),
  info: (m) => console.info(m),
  warn: (m) => console.warn(m),
  error: (m) => console.error(m),
};

export class Logger {
  constructor(private readonly base: LogFields = {}) {}

  /** Derive a logger with additional bound context (e.g. per-request traceId). */
  child(fields: LogFields): Logger {
    return new Logger({ ...this.base, ...fields });
  }

  debug(msg: string, fields?: LogFields): void {
    this.write("debug", msg, fields);
  }
  info(msg: string, fields?: LogFields): void {
    this.write("info", msg, fields);
  }
  warn(msg: string, fields?: LogFields): void {
    this.write("warn", msg, fields);
  }
  /** Log an error line; pass the throwable as `fields.err` to serialize it. */
  error(msg: string, fields?: LogFields & { err?: unknown }): void {
    this.write("error", msg, fields);
  }

  private write(level: LogLevel, msg: string, fields?: LogFields & { err?: unknown }): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
    try {
      const { err, ...rest } = fields ?? {};
      const record: Record<string, unknown> = {
        level,
        time: new Date().toISOString(),
        msg,
        ...(scrub({ ...this.base, ...rest }) as Record<string, unknown>),
      };
      if (err !== undefined) record.error = serializeError(err, IS_PROD);
      CONSOLE[level](JSON.stringify(record));
    } catch {
      // Never let logging break a handler; fall back to a minimal line.
      try {
        CONSOLE[level](`{"level":"${level}","msg":"log_serialize_failed"}`);
      } catch {
        /* give up silently */
      }
    }
  }
}

/** Root application logger. Prefer `logger.child({ traceId, shop })` per request. */
export const logger = new Logger({ service: "web" });

/** Create a logger for a specific service/tier (e.g. `worker`). */
export function createLogger(base: LogFields): Logger {
  return new Logger(base);
}
