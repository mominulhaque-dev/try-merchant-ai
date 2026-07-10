import { describe, it, expect } from "vitest";
import { AppError } from "./app-error";

describe("AppError", () => {
  it("uses the code's default message and http status", () => {
    const e = new AppError("NOT_FOUND");
    expect(e.httpStatus).toBe(404);
    expect(e.retryable).toBe(false);
    expect(e.message.length).toBeGreaterThan(0);
  });

  it("allows a safe message override without changing the code", () => {
    const e = new AppError("VALIDATION", { message: "Title is too long." });
    expect(e.code).toBe("VALIDATION");
    expect(e.message).toBe("Title is too long.");
  });

  it("wraps unknown throwables as INTERNAL and preserves cause", () => {
    const original = new Error("boom");
    const wrapped = AppError.from(original, "trace-1");
    expect(wrapped.code).toBe("INTERNAL");
    expect(wrapped.traceId).toBe("trace-1");
    expect(wrapped.cause).toBe(original);
  });

  it("returns an existing AppError unchanged when it already has a trace", () => {
    const e = new AppError("CONFLICT", { traceId: "t" });
    expect(AppError.from(e)).toBe(e);
  });

  it("serializes to an envelope without leaking the cause", () => {
    const e = new AppError("RATE_LIMITED", {
      cause: new Error("internal detail"),
      details: { retryAfter: 5 },
    });
    const env = e.toEnvelope("trace-2");
    expect(env.ok).toBe(false);
    expect(env.error.code).toBe("RATE_LIMITED");
    expect(env.error.retryable).toBe(true);
    expect(env.meta.traceId).toBe("trace-2");
    expect(JSON.stringify(env)).not.toContain("internal detail");
  });
});
