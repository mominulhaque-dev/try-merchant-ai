import { AppError } from "../errors";

/**
 * Validated, typed server configuration (docs/37 "Secrets & config", 12-factor).
 *
 * Reads from `process.env` and exposes a strongly-typed, memoized config object.
 * It does NOT throw at import time — the current template boots with only
 * Shopify vars, and unused subsystems (Postgres/Redis/AI) are wired later
 * (see docs/_IMPLEMENTATION). Call {@link assertProductionConfig} at server
 * startup to fail fast in production when a critical var is missing.
 *
 * Secrets are never logged from here (docs/41).
 */

export type NodeEnv = "development" | "test" | "production";

export interface ServerConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProd: boolean;
  readonly isTest: boolean;
  readonly logLevel: string | undefined;
  readonly shopify: {
    readonly apiKey: string | undefined;
    readonly apiSecret: string | undefined;
    readonly appUrl: string | undefined;
    readonly scopes: readonly string[];
    readonly customDomain: string | undefined;
  };
  readonly database: {
    /** Present once the Postgres cutover (M0.T7) is applied. */
    readonly url: string | undefined;
  };
  readonly redis: {
    readonly url: string | undefined;
  };
  readonly ai: {
    readonly anthropicApiKey: string | undefined;
    readonly openaiApiKey: string | undefined;
  };
}

function readEnv(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value === "" ? undefined : value;
}

function readNodeEnv(): NodeEnv {
  const raw = process.env.NODE_ENV;
  return raw === "production" || raw === "test" ? raw : "development";
}

function build(): ServerConfig {
  const nodeEnv = readNodeEnv();
  return {
    nodeEnv,
    isProd: nodeEnv === "production",
    isTest: nodeEnv === "test",
    logLevel: readEnv("LOG_LEVEL"),
    shopify: {
      apiKey: readEnv("SHOPIFY_API_KEY"),
      apiSecret: readEnv("SHOPIFY_API_SECRET"),
      appUrl: readEnv("SHOPIFY_APP_URL"),
      scopes: (readEnv("SCOPES") ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      customDomain: readEnv("SHOP_CUSTOM_DOMAIN"),
    },
    database: { url: readEnv("DATABASE_URL") },
    redis: { url: readEnv("REDIS_URL") },
    ai: {
      anthropicApiKey: readEnv("ANTHROPIC_API_KEY"),
      openaiApiKey: readEnv("OPENAI_API_KEY"),
    },
  };
}

let cached: ServerConfig | undefined;

/** Memoized, typed server configuration. */
export function getConfig(): ServerConfig {
  if (!cached) cached = build();
  return cached;
}

/**
 * Fail fast when required production configuration is missing. Call this once
 * during server boot in production (docs/37). Lists ALL missing keys at once so
 * ops sees a complete picture rather than fixing one var at a time.
 */
export function assertProductionConfig(): void {
  const cfg = getConfig();
  if (!cfg.isProd) return;

  const required: Array<[string, unknown]> = [
    ["SHOPIFY_API_KEY", cfg.shopify.apiKey],
    ["SHOPIFY_API_SECRET", cfg.shopify.apiSecret],
    ["SHOPIFY_APP_URL", cfg.shopify.appUrl],
    ["DATABASE_URL", cfg.database.url],
  ];
  const missing = required.filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    throw new AppError("INTERNAL", {
      message: "Server misconfiguration.",
      details: { missingEnv: missing },
    });
  }
}
