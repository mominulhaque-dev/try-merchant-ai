import type { ModelProvider, ModelRef } from "../agents/types";

/**
 * AI provider abstraction contracts (docs/16 "Model provider abstraction",
 * ADR-016-2).
 *
 * A single uniform interface sits over every model vendor — Anthropic (Claude,
 * primary), OpenAI (secondary/specialist), and a cheap tier for
 * classification/formatting. Agents and the orchestrator depend only on these
 * types, never on a vendor SDK, so provider failover is transparent and the
 * platform never hard-couples to one vendor (docs/00 P6, docs/16 fallback).
 *
 * Model-tier selection (primary → fallback → cheap) comes from each
 * {@link ModelRef} on an `AgentSpec.model`; the {@link AIService} maps a
 * requested {@link ModelTier} to a concrete provider + model at call time.
 */

/** Which model tier a task should run on (docs/16 model tiering, docs/00 P7). */
export type ModelTier = "primary" | "fallback" | "cheap";

/** A role in a model conversation. `system` is carried separately on the request. */
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
}

/**
 * A JSON-schema description of the structured output the caller requires. When
 * present, the provider constrains the model to emit JSON matching it and the
 * result's {@link CompletionResult.parsed} is populated (docs/16 structured
 * prompts). Kept as a plain object so the contract has no schema-library
 * dependency; validators are attached by callers where needed.
 */
export interface JsonSchema {
  readonly name: string;
  readonly schema: Record<string, unknown>;
}

/**
 * Reasoning effort, mapped uniformly across providers (docs/16). Higher effort
 * trades latency/cost for depth; providers that lack a native knob approximate
 * it (e.g. via token ceilings) rather than ignore it.
 */
export type Effort = "low" | "medium" | "high";

export interface CompletionRequest {
  /** System prompt (the agent's charter + role). Stable, cache-friendly first. */
  readonly system: string;
  readonly messages: readonly ChatMessage[];
  /** Hard ceiling on output tokens for this call (docs/00 P7 budgets). */
  readonly maxTokens: number;
  readonly effort?: Effort;
  /** When set, require the model to return JSON matching this schema. */
  readonly responseFormat?: JsonSchema;
  /** Correlation id threaded into provider calls + telemetry (docs/39). */
  readonly traceId: string;
  /** Optional per-call deadline in ms; providers abort past it (docs/40). */
  readonly timeoutMs?: number;
}

/** Token accounting returned by every provider, normalized (docs/27 metering). */
export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** Provider-reported cached-read input tokens, when available (docs/33). */
  readonly cachedInputTokens?: number;
}

export type StopReason =
  | "stop" // natural end of turn
  | "length" // hit the max-tokens ceiling
  | "refusal" // model declined (docs/23 safety)
  | "other";

export interface CompletionResult {
  readonly text: string;
  /** Present only when {@link CompletionRequest.responseFormat} was requested. */
  readonly parsed?: unknown;
  readonly usage: TokenUsage;
  readonly stopReason: StopReason;
  /** The provider + model that actually produced this result (post-failover). */
  readonly provider: ModelProvider;
  readonly model: string;
}

/** One streamed text delta; terminal chunks carry the final usage + stop reason. */
export interface CompletionChunk {
  readonly delta: string;
  readonly done: boolean;
  readonly usage?: TokenUsage;
  readonly stopReason?: StopReason;
  readonly provider?: ModelProvider;
  readonly model?: string;
}

/**
 * The uniform provider port (ports-and-adapters, docs/16). Concrete adapters
 * (Anthropic, OpenAI, …) implement this; the {@link AIService} is the only thing
 * that composes them, so callers never see a vendor type. A provider translates
 * these vendor-neutral requests to its own API and normalizes the response back.
 */
export interface AIProvider {
  readonly id: ModelProvider;
  complete(model: string, req: CompletionRequest): Promise<CompletionResult>;
  /**
   * Stream a completion as text deltas. The final chunk has `done: true` and
   * carries usage + stop reason. Implementations must surface transport errors
   * as thrown {@link ../errors.AppError} so the service can fail over.
   */
  stream(model: string, req: CompletionRequest): AsyncIterable<CompletionChunk>;
}

/** Resolve a tier to a concrete provider+model for a task (docs/16 tiering). */
export interface ModelResolution {
  readonly tier: ModelTier;
  readonly ref: ModelRef;
}
