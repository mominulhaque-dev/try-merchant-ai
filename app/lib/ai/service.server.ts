import { AppError, err, ok, type Result } from "../errors";
import { Logger } from "../telemetry/logger.server";
import type { Shop } from "../security/tenant.server";
import type { AgentSpec, ModelProvider, ModelRef } from "../agents/types";
import type {
  AIProvider,
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  ModelTier,
  TokenUsage,
} from "./types";

/**
 * The AI service (docs/16 "Model provider abstraction", ADR-016-2) — the single
 * entry point every agent and the orchestrator use to talk to a model. It:
 *
 *   1. Resolves a requested {@link ModelTier} (primary/fallback/cheap) to a
 *      concrete {@link ModelRef} from the agent's `AgentSpec.model` (tiering).
 *   2. Enforces a per-shop AAC budget *before* spending (docs/00 P7, docs/27),
 *      and meters actual usage back after a successful call.
 *   3. Fails over automatically across providers on a retryable outage
 *      (docs/16 fallback): primary → the other configured tiers → surface.
 *
 * It depends only on the vendor-neutral {@link AIProvider} port, so providers are
 * fully swappable and the orchestration is unit-testable with a fake provider.
 */

/** Budget guard for model spend (mirrors the action-pipeline BudgetPort, docs/27). */
export interface AIBudgetPort {
  /** Throw BUDGET_EXCEEDED if the shop cannot afford `estimatedAAC`. */
  ensure(shop: Shop, estimatedAAC: number): Promise<void>;
  /** Record actual spend after a completed call. */
  consume(
    shop: Shop,
    aac: number,
    meta: { agentId?: string; provider: string; model: string; traceId: string },
  ): Promise<void>;
}

/** Convert token usage to AI Action Credits (docs/27). One AAC ≈ 1k tokens. */
export function usageToAAC(usage: TokenUsage): number {
  const billable = usage.inputTokens + usage.outputTokens * 4; // output weighted
  return Math.max(1, Math.ceil(billable / 1000));
}

export interface AIServiceDeps {
  /** Providers keyed by id; the service picks per resolved {@link ModelRef}. */
  readonly providers: Partial<Record<ModelProvider, AIProvider>>;
  readonly budget: AIBudgetPort;
  readonly logger?: Logger;
}

export interface AICallContext {
  readonly shop: Shop;
  readonly spec: AgentSpec;
  /** Requested tier; the service still fails over to the others on outage. */
  readonly tier: ModelTier;
  readonly traceId: string;
}

/** Order the tiers to attempt, starting from the requested one (docs/16). */
function failoverOrder(start: ModelTier): ModelTier[] {
  const all: ModelTier[] = ["primary", "fallback", "cheap"];
  return [start, ...all.filter((t) => t !== start)];
}

export class AIService {
  private readonly log: Logger;

  constructor(private readonly deps: AIServiceDeps) {
    this.log = deps.logger ?? new Logger({ service: "ai-service" });
  }

  private resolve(spec: AgentSpec, tier: ModelTier): ModelRef {
    return spec.model[tier];
  }

  private provider(ref: ModelRef): AIProvider | undefined {
    return this.deps.providers[ref.provider];
  }

  /**
   * Run a completion with budget enforcement and automatic cross-tier failover.
   * Returns the first successful result; if every configured tier fails, returns
   * the last error (a retryable PROVIDER_UNAVAILABLE/RATE_LIMITED/TIMEOUT).
   */
  async complete(
    ctx: AICallContext,
    req: CompletionRequest,
  ): Promise<Result<CompletionResult>> {
    const log = this.log.child({ traceId: ctx.traceId, shop: ctx.shop, agent: ctx.spec.id });

    // Budget gate before any spend (docs/00 P7). Estimated from the output cap.
    const estimate = usageToAAC({ inputTokens: 0, outputTokens: req.maxTokens });
    try {
      await this.deps.budget.ensure(ctx.shop, estimate);
    } catch (error) {
      return err(AppError.from(error, ctx.traceId));
    }

    let lastError: AppError | undefined;
    for (const tier of failoverOrder(ctx.tier)) {
      const ref = this.resolve(ctx.spec, tier);
      const provider = this.provider(ref);
      if (!provider) continue; // provider not configured (e.g. missing key)

      try {
        const result = await provider.complete(ref.model, req);
        await this.meter(ctx, result.usage, ref);
        log.info("ai.complete.ok", {
          tier,
          provider: ref.provider,
          model: ref.model,
          outputTokens: result.usage.outputTokens,
        });
        return ok(result);
      } catch (error) {
        const appError = AppError.from(error, ctx.traceId);
        lastError = appError;
        if (!appError.retryable) {
          // A validation/permission error won't be fixed by another provider.
          log.warn("ai.complete.nonretryable", { tier, code: appError.code });
          return err(appError);
        }
        log.warn("ai.complete.failover", { tier, provider: ref.provider, code: appError.code });
      }
    }

    return err(
      lastError ??
        new AppError("PROVIDER_UNAVAILABLE", {
          message: "No AI provider is configured.",
          traceId: ctx.traceId,
        }),
    );
  }

  /**
   * Stream a completion. Streaming does not fail over mid-stream (partial output
   * would be lost); it fails over only if the *initial* connection to a tier
   * throws before any delta. Usage is metered from the terminal chunk.
   */
  async *stream(
    ctx: AICallContext,
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    const log = this.log.child({ traceId: ctx.traceId, shop: ctx.shop, agent: ctx.spec.id });

    const estimate = usageToAAC({ inputTokens: 0, outputTokens: req.maxTokens });
    await this.deps.budget.ensure(ctx.shop, estimate);

    let lastError: AppError | undefined;
    for (const tier of failoverOrder(ctx.tier)) {
      const ref = this.resolve(ctx.spec, tier);
      const provider = this.provider(ref);
      if (!provider) continue;

      const iterator = provider.stream(ref.model, req)[Symbol.asyncIterator]();
      // Probe the first chunk so a connection-time outage can fail over before
      // the caller has consumed anything.
      let first: IteratorResult<CompletionChunk>;
      try {
        first = await iterator.next();
      } catch (error) {
        const appError = AppError.from(error, ctx.traceId);
        lastError = appError;
        if (!appError.retryable) throw appError;
        log.warn("ai.stream.failover", { tier, provider: ref.provider, code: appError.code });
        continue;
      }

      // Committed to this provider — stream the rest; a mid-stream error surfaces.
      yield* this.drain(ctx, ref, first, iterator);
      return;
    }

    throw (
      lastError ??
      new AppError("PROVIDER_UNAVAILABLE", {
        message: "No AI provider is configured.",
        traceId: ctx.traceId,
      })
    );
  }

  private async *drain(
    ctx: AICallContext,
    ref: ModelRef,
    first: IteratorResult<CompletionChunk>,
    iterator: AsyncIterator<CompletionChunk>,
  ): AsyncIterable<CompletionChunk> {
    let current = first;
    while (!current.done) {
      const chunk = current.value;
      if (chunk.done && chunk.usage) {
        await this.meter(ctx, chunk.usage, ref);
      }
      yield chunk;
      current = await iterator.next();
    }
  }

  private async meter(ctx: AICallContext, usage: TokenUsage, ref: ModelRef): Promise<void> {
    const aac = usageToAAC(usage);
    await this.deps.budget.consume(ctx.shop, aac, {
      agentId: ctx.spec.id,
      provider: ref.provider,
      model: ref.model,
      traceId: ctx.traceId,
    });
  }
}
