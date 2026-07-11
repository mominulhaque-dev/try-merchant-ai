import { describe, it, expect } from "vitest";
import { mapProviderError } from "./errors.server";
import { AppError } from "../errors";

const ctx = { provider: "anthropic", traceId: "t1" };

describe("mapProviderError", () => {
  it("passes AppErrors through and stamps the trace", () => {
    const original = new AppError("VALIDATION", {});
    const mapped = mapProviderError(original, ctx);
    expect(mapped.code).toBe("VALIDATION");
    expect(mapped.traceId).toBe("t1");
  });

  it("maps 429 to a retryable RATE_LIMITED", () => {
    const mapped = mapProviderError({ status: 429 }, ctx);
    expect(mapped.code).toBe("RATE_LIMITED");
    expect(mapped.retryable).toBe(true);
  });

  it("maps 5xx to a retryable PROVIDER_UNAVAILABLE", () => {
    const mapped = mapProviderError({ status: 503 }, ctx);
    expect(mapped.code).toBe("PROVIDER_UNAVAILABLE");
    expect(mapped.retryable).toBe(true);
  });

  it("maps 400/422 to a non-retryable VALIDATION", () => {
    expect(mapProviderError({ status: 400 }, ctx).code).toBe("VALIDATION");
    expect(mapProviderError({ status: 422 }, ctx).retryable).toBe(false);
  });

  it("maps auth failures to PROVIDER_UNAVAILABLE (our key, not the merchant's)", () => {
    expect(mapProviderError({ status: 401 }, ctx).code).toBe("PROVIDER_UNAVAILABLE");
    expect(mapProviderError({ status: 403 }, ctx).code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("maps aborts/timeouts to TIMEOUT", () => {
    const mapped = mapProviderError({ name: "AbortError" }, ctx);
    expect(mapped.code).toBe("TIMEOUT");
    expect(mapped.retryable).toBe(true);
  });

  it("reads status off a nested response object", () => {
    expect(mapProviderError({ response: { status: 429 } }, ctx).code).toBe("RATE_LIMITED");
  });

  it("defaults unknown transport failures to a retryable PROVIDER_UNAVAILABLE", () => {
    const mapped = mapProviderError(new Error("socket hang up"), ctx);
    expect(mapped.code).toBe("PROVIDER_UNAVAILABLE");
    expect(mapped.retryable).toBe(true);
  });
});
