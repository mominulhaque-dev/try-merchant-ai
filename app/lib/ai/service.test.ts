import { describe, it, expect } from "vitest";
import { AIService, usageToAAC, type AIBudgetPort } from "./service.server";
import type {
  AIProvider,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
} from "./types";
import { AGENT_SPECS } from "../agents/specs";
import { assertShop } from "../security/tenant.server";
import { AppError } from "../errors";
import type { ModelProvider } from "../agents/types";

/** A deterministic in-memory provider — exercises the service with no network. */
class FakeProvider implements AIProvider {
  calls = 0;
  constructor(
    readonly id: ModelProvider,
    private readonly behavior:
      | { kind: "ok"; text: string }
      | { kind: "throw"; error: AppError },
  ) {}

  async complete(model: string, req: CompletionRequest): Promise<CompletionResult> {
    this.calls += 1;
    if (this.behavior.kind === "throw") throw this.behavior.error;
    return {
      text: this.behavior.text,
      usage: { inputTokens: 100, outputTokens: 50 },
      stopReason: "stop",
      provider: this.id,
      model,
      ...(req.responseFormat ? { parsed: { ok: true } } : {}),
    };
  }

  async *stream(model: string, req: CompletionRequest): AsyncIterable<CompletionChunk> {
    this.calls += 1;
    if (this.behavior.kind === "throw") throw this.behavior.error;
    yield { delta: this.behavior.text, done: false };
    yield {
      delta: "",
      done: true,
      usage: { inputTokens: 100, outputTokens: 50 },
      stopReason: "stop",
      provider: this.id,
      model,
    };
  }
}

class RecordingBudget implements AIBudgetPort {
  ensured: number[] = [];
  consumed: Array<{ aac: number; provider: string; model: string }> = [];
  constructor(private readonly ceiling = 100_000) {}
  async ensure(_shop: string, aac: number): Promise<void> {
    this.ensured.push(aac);
    if (aac > this.ceiling) {
      throw new AppError("BUDGET_EXCEEDED", { details: { ceiling: this.ceiling } });
    }
  }
  async consume(
    _shop: string,
    aac: number,
    meta: { provider: string; model: string; traceId: string },
  ): Promise<void> {
    this.consumed.push({ aac, provider: meta.provider, model: meta.model });
  }
}

const shop = assertShop("ai.myshopify.com");

function ctx(tier: "primary" | "fallback" | "cheap" = "primary") {
  return { shop, spec: AGENT_SPECS.seo, tier, traceId: "trace-ai" };
}

function req(overrides: Partial<CompletionRequest> = {}): CompletionRequest {
  return {
    system: "You are the SEO agent.",
    messages: [{ role: "user", content: "Draft an SEO title." }],
    maxTokens: 1000,
    traceId: "trace-ai",
    ...overrides,
  };
}

const outage = new AppError("PROVIDER_UNAVAILABLE", {});
const badRequest = new AppError("VALIDATION", {});

describe("usageToAAC", () => {
  it("weights output tokens and floors at 1", () => {
    expect(usageToAAC({ inputTokens: 0, outputTokens: 0 })).toBe(1);
    expect(usageToAAC({ inputTokens: 1000, outputTokens: 1000 })).toBe(5); // (1000 + 4000)/1000
  });
});

describe("AIService.complete", () => {
  it("uses the primary provider and meters usage", async () => {
    const primary = new FakeProvider("anthropic", { kind: "ok", text: "Great Title" });
    const budget = new RecordingBudget();
    const service = new AIService({ providers: { anthropic: primary }, budget });

    const result = await service.complete(ctx(), req());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.text).toBe("Great Title");
    expect(result.value.provider).toBe("anthropic");
    expect(primary.calls).toBe(1);
    expect(budget.ensured.length).toBe(1);
    expect(budget.consumed[0]?.provider).toBe("anthropic");
  });

  it("fails over to the fallback provider on a retryable outage", async () => {
    const primary = new FakeProvider("anthropic", { kind: "throw", error: outage });
    const fallback = new FakeProvider("openai", { kind: "ok", text: "From OpenAI" });
    const budget = new RecordingBudget();
    const service = new AIService({
      providers: { anthropic: primary, openai: fallback },
      budget,
    });

    const result = await service.complete(ctx(), req());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.provider).toBe("openai");
    expect(primary.calls).toBe(1);
    expect(fallback.calls).toBe(1);
  });

  it("does not fail over on a non-retryable error", async () => {
    const primary = new FakeProvider("anthropic", { kind: "throw", error: badRequest });
    const fallback = new FakeProvider("openai", { kind: "ok", text: "unused" });
    const budget = new RecordingBudget();
    const service = new AIService({
      providers: { anthropic: primary, openai: fallback },
      budget,
    });

    const result = await service.complete(ctx(), req());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
    expect(fallback.calls).toBe(0); // not attempted
  });

  it("blocks the call when the budget is exceeded, before any provider call", async () => {
    const primary = new FakeProvider("anthropic", { kind: "ok", text: "x" });
    const budget = new RecordingBudget(1); // tiny ceiling
    const service = new AIService({ providers: { anthropic: primary }, budget });

    const result = await service.complete(ctx(), req({ maxTokens: 100_000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("BUDGET_EXCEEDED");
    expect(primary.calls).toBe(0);
  });

  it("resolves the requested tier from the agent spec", async () => {
    const cheapRef = AGENT_SPECS.seo.model.cheap;
    const cheap = new FakeProvider(cheapRef.provider, { kind: "ok", text: "cheap tier" });
    const budget = new RecordingBudget();
    // Register the provider under the cheap tier's own provider id (tier-agnostic).
    const service = new AIService({ providers: { [cheapRef.provider]: cheap }, budget });

    const result = await service.complete(ctx("cheap"), req());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.model).toBe(cheapRef.model);
  });

  it("returns PROVIDER_UNAVAILABLE when no provider is configured", async () => {
    const budget = new RecordingBudget();
    const service = new AIService({ providers: {}, budget });
    const result = await service.complete(ctx(), req());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("PROVIDER_UNAVAILABLE");
  });

  it("passes a response-format request through and returns parsed output", async () => {
    const primary = new FakeProvider("anthropic", { kind: "ok", text: '{"ok":true}' });
    const budget = new RecordingBudget();
    const service = new AIService({ providers: { anthropic: primary }, budget });

    const result = await service.complete(
      ctx(),
      req({ responseFormat: { name: "r", schema: { type: "object" } } }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.parsed).toEqual({ ok: true });
  });
});

describe("AIService.stream", () => {
  it("streams deltas and meters usage from the terminal chunk", async () => {
    const primary = new FakeProvider("anthropic", { kind: "ok", text: "Hello" });
    const budget = new RecordingBudget();
    const service = new AIService({ providers: { anthropic: primary }, budget });

    const chunks: string[] = [];
    let done = false;
    for await (const chunk of service.stream(ctx(), req())) {
      if (chunk.delta) chunks.push(chunk.delta);
      if (chunk.done) done = true;
    }
    expect(chunks.join("")).toBe("Hello");
    expect(done).toBe(true);
    expect(budget.consumed.length).toBe(1);
  });

  it("fails over on a connection-time outage before any delta", async () => {
    const primary = new FakeProvider("anthropic", { kind: "throw", error: outage });
    const fallback = new FakeProvider("openai", { kind: "ok", text: "hi" });
    const budget = new RecordingBudget();
    const service = new AIService({
      providers: { anthropic: primary, openai: fallback },
      budget,
    });

    const chunks: string[] = [];
    for await (const chunk of service.stream(ctx(), req())) {
      if (chunk.delta) chunks.push(chunk.delta);
    }
    expect(chunks.join("")).toBe("hi");
    expect(fallback.calls).toBe(1);
  });
});
