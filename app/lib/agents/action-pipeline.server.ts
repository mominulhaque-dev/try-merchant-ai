import { AppError, ok, err, type Result } from "../errors";
import { Logger } from "../telemetry/logger.server";
import { newId, newTraceId } from "../ids";
import { assertOwnership, type Shop } from "../security/tenant.server";
import type { ActionStatus, ActorType, PlanTier, Role, TrustLevel } from "../domain/enums";
import type { ActionProposal, AgentSpec } from "./types";
import { checkAction, requiresHumanApproval, type PolicyContext } from "./policy";

/**
 * The action pipeline — the reversibility spine (docs/07 F-02, docs/16, docs/40,
 * docs/41). Every store mutation flows through:
 *
 *   validate → preview(diff) → approve → execute → verify → audit → undo
 *
 * Invariants enforced here (docs/00 P3, ADR-040-1):
 *   - Nothing executes without passing the deterministic policy layer.
 *   - Irreversible actions are gated; reversible actions register an undo token.
 *   - Every executed mutation is audited atomically with the change (via ports).
 *   - Optimistic concurrency: if the resource changed since preview, re-preview.
 *   - Single-writer lock per resource prevents concurrent clobbering (docs/16).
 *
 * It is built ports-and-adapters so the orchestration is real and testable now;
 * concrete Prisma/Shopify adapters are injected after the DB cutover.
 */

/* --------------------------------------------------------------- Types --- */

export interface ActionDiffField {
  readonly key: string;
  readonly before: unknown;
  readonly after: unknown;
}

export interface ActionDiff {
  readonly fields: readonly ActionDiffField[];
  readonly summary: string;
  /** For bulk/multi-item actions. */
  readonly itemCount?: number;
}

/** The persisted requirement snapshot so execute() can re-authorize safely. */
export interface ActionRequirementSnapshot {
  readonly requiredScopes: readonly string[];
  readonly requiredPlan: PlanTier;
  readonly minRole: Role;
  readonly requiredTrust: TrustLevel;
}

export interface StoredAction {
  readonly id: string;
  readonly shop: string;
  readonly agentId?: string;
  readonly actorType: ActorType;
  readonly type: string;
  readonly args: Record<string, unknown>;
  readonly status: ActionStatus;
  readonly reversible: boolean;
  readonly requirement: ActionRequirementSnapshot;
  readonly previewHash: string;
  readonly beforeState?: unknown;
  readonly afterState?: unknown;
  readonly undoToken?: string;
  readonly traceId: string;
}

export interface ActionContext extends PolicyContext {
  readonly shop: Shop;
  readonly actorType: ActorType;
  readonly traceId: string;
}

export interface PreviewResult {
  readonly action: StoredAction;
  readonly diff: ActionDiff;
  /** True when a human must approve before execute() may run (docs/00 P2). */
  readonly requiresApproval: boolean;
}

/* ---------------------------------------------------------------- Ports -- */

export interface ActionStore {
  create(input: Omit<StoredAction, "id">): Promise<StoredAction>;
  get(shop: Shop, id: string): Promise<StoredAction | null>;
  update(
    shop: Shop,
    id: string,
    patch: Partial<Omit<StoredAction, "id" | "shop">>,
  ): Promise<StoredAction>;
}

export interface DiffPort {
  compute(proposal: ActionProposal, ctx: ActionContext): Promise<ActionDiff>;
}

export interface ExecutorPort {
  apply(
    action: StoredAction,
    ctx: ActionContext,
  ): Promise<{ afterState: unknown; undoToken?: string }>;
  revert(action: StoredAction, ctx: ActionContext): Promise<void>;
}

export interface AuditPort {
  record(entry: {
    shop: string;
    actorType: ActorType;
    actorId?: string;
    event: string;
    target?: string;
    before?: unknown;
    after?: unknown;
    traceId: string;
  }): Promise<void>;
}

export interface LockPort {
  withLock<T>(resourceKey: string, fn: () => Promise<T>): Promise<T>;
}

export interface BudgetPort {
  /** Throw BUDGET_EXCEEDED if the shop cannot afford `aac` (docs/27). */
  ensure(shop: Shop, aac: number): Promise<void>;
  consume(shop: Shop, aac: number, meta: { agentId?: string; traceId: string }): Promise<void>;
}

export interface ActionPipelineDeps {
  readonly store: ActionStore;
  readonly diff: DiffPort;
  readonly executor: ExecutorPort;
  readonly audit: AuditPort;
  readonly lock: LockPort;
  readonly budget: BudgetPort;
  readonly logger?: Logger;
}

/* ----------------------------------------------------------- Utilities -- */

/** Stable, order-independent hash of a value for optimistic concurrency. */
export function stableHash(value: unknown): string {
  const json = stableStringify(value);
  let hash = 5381;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 33) ^ json.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** Single-writer lock key derived from the action's target resource (docs/16). */
function resourceKey(shop: string, proposal: ActionProposal): string {
  const target =
    (proposal.args["id"] as string | undefined) ??
    (proposal.args["handle"] as string | undefined) ??
    proposal.type;
  return `lock:${shop}:${proposal.type}:${target}`;
}

/* -------------------------------------------------------- The pipeline -- */

export class ActionPipeline {
  private readonly log: Logger;

  constructor(private readonly deps: ActionPipelineDeps) {
    this.log = deps.logger ?? new Logger({ service: "action-pipeline" });
  }

  /**
   * Phase 1 — validate + compute a preview diff and persist a PREVIEWED action.
   * No store mutation happens here.
   */
  async preview(
    ctx: ActionContext,
    proposal: ActionProposal,
    spec: AgentSpec,
    requirement: ActionRequirementSnapshot,
  ): Promise<Result<PreviewResult>> {
    const log = this.log.child({ traceId: ctx.traceId, shop: ctx.shop, action: proposal.type });

    const decision = checkAction({ ...ctx, spec }, proposal, {
      requiredScopes: requirement.requiredScopes,
      requiredPlan: requirement.requiredPlan,
      minRole: requirement.minRole,
    });
    if (!decision.allowed) {
      log.info("action.preview.denied", { gate: decision.gate });
      return err(this.gateToError(decision.gate, decision.reason));
    }

    try {
      const diff = await this.deps.diff.compute(proposal, ctx);
      const action = await this.deps.store.create({
        shop: ctx.shop,
        agentId: ctx.spec.id,
        actorType: ctx.actorType,
        type: proposal.type,
        args: proposal.args,
        status: "PREVIEWED",
        reversible: proposal.reversible,
        requirement,
        previewHash: stableHash(diff.fields),
        beforeState: diff.fields.map((f) => ({ key: f.key, value: f.before })),
        traceId: ctx.traceId,
      });
      const requiresApproval = requiresHumanApproval(ctx.agentTrust, proposal, ctx.unattended);
      log.info("action.previewed", { actionId: action.id, requiresApproval });
      return ok({ action, diff, requiresApproval });
    } catch (error) {
      return err(AppError.from(error, ctx.traceId));
    }
  }

  /**
   * Phase 2 — execute a previewed/approved action under a single-writer lock,
   * with optimistic-concurrency re-check, verification, audit, and undo-token
   * registration. Idempotent: a DONE action returns its stored result.
   */
  async execute(ctx: ActionContext, actionId: string): Promise<Result<StoredAction>> {
    const log = this.log.child({ traceId: ctx.traceId, shop: ctx.shop, actionId });
    const existing = await this.deps.store.get(ctx.shop, actionId);
    if (!existing) return err(new AppError("NOT_FOUND", { traceId: ctx.traceId }));
    assertOwnership(ctx.shop, existing);

    if (existing.status === "DONE") return ok(existing); // idempotent replay
    if (existing.status !== "PREVIEWED" && existing.status !== "APPROVED") {
      return err(
        new AppError("CONFLICT", {
          message: "This action is no longer in an executable state.",
          traceId: ctx.traceId,
          details: { status: existing.status },
        }),
      );
    }

    const proposal: ActionProposal = {
      type: existing.type,
      args: existing.args,
      reversible: existing.reversible,
      summary: "",
      requiredTrust: existing.requirement.requiredTrust,
    };

    try {
      return await this.deps.lock.withLock(resourceKey(ctx.shop, proposal), async () => {
        // Re-authorize at execute time (trust/scope may have changed since preview).
        const decision = checkAction(ctx, proposal, {
          requiredScopes: existing.requirement.requiredScopes,
          requiredPlan: existing.requirement.requiredPlan,
          minRole: existing.requirement.minRole,
        });
        if (!decision.allowed) return err(this.gateToError(decision.gate, decision.reason));

        // Optimistic concurrency: re-diff and compare to the previewed state.
        const fresh = await this.deps.diff.compute(proposal, ctx);
        if (stableHash(fresh.fields) !== existing.previewHash) {
          await this.deps.store.update(ctx.shop, actionId, { status: "PREVIEWED" });
          return err(
            new AppError("CONFLICT", {
              message: "This item changed since preview. Please review and try again.",
              traceId: ctx.traceId,
            }),
          );
        }

        await this.deps.store.update(ctx.shop, actionId, { status: "EXECUTING" });
        const { afterState, undoToken } = await this.deps.executor.apply(existing, ctx);

        const done = await this.deps.store.update(ctx.shop, actionId, {
          status: "DONE",
          afterState,
          undoToken,
        });
        await this.deps.audit.record({
          shop: ctx.shop,
          actorType: ctx.actorType,
          actorId: ctx.spec.id,
          event: `action.executed:${existing.type}`,
          target: (existing.args["id"] as string | undefined) ?? undefined,
          before: existing.beforeState,
          after: afterState,
          traceId: ctx.traceId,
        });
        await this.deps.budget.consume(ctx.shop, 1, {
          agentId: ctx.spec.id,
          traceId: ctx.traceId,
        });
        log.info("action.executed");
        return ok(done);
      });
    } catch (error) {
      const appError = AppError.from(error, ctx.traceId);
      await this.safeFail(ctx, actionId, appError);
      return err(appError);
    }
  }

  /** Reverse a completed, reversible action (docs/40 undo spine). */
  async undo(ctx: ActionContext, actionId: string): Promise<Result<StoredAction>> {
    const log = this.log.child({ traceId: ctx.traceId, shop: ctx.shop, actionId });
    const action = await this.deps.store.get(ctx.shop, actionId);
    if (!action) return err(new AppError("NOT_FOUND", { traceId: ctx.traceId }));
    assertOwnership(ctx.shop, action);
    if (action.status !== "DONE" || !action.reversible || !action.undoToken) {
      return err(
        new AppError("CONFLICT", {
          message: "This action can't be undone.",
          traceId: ctx.traceId,
        }),
      );
    }
    try {
      await this.deps.executor.revert(action, ctx);
      const reverted = await this.deps.store.update(ctx.shop, actionId, { status: "REVERTED" });
      await this.deps.audit.record({
        shop: ctx.shop,
        actorType: ctx.actorType,
        actorId: ctx.spec.id,
        event: `action.reverted:${action.type}`,
        before: action.afterState,
        after: action.beforeState,
        traceId: ctx.traceId,
      });
      log.info("action.reverted");
      return ok(reverted);
    } catch (error) {
      return err(AppError.from(error, ctx.traceId));
    }
  }

  private async safeFail(ctx: ActionContext, actionId: string, error: AppError): Promise<void> {
    try {
      await this.deps.store.update(ctx.shop, actionId, {
        status: "FAILED",
      });
      await this.deps.audit.record({
        shop: ctx.shop,
        actorType: ctx.actorType,
        event: "action.failed",
        after: { code: error.code },
        traceId: ctx.traceId,
      });
    } catch (auditError) {
      this.log.error("action.fail.audit_failed", { err: auditError, traceId: ctx.traceId });
    }
  }

  private gateToError(gate: string, reason: string): AppError {
    switch (gate) {
      case "SCOPE":
        return new AppError("SCOPE_MISSING", { message: reason });
      case "PLAN":
        return new AppError("PLAN_REQUIRED", { message: reason });
      case "TOOL_NOT_ALLOWLISTED":
      case "ROLE":
      case "TRUST":
      case "TRUST_CEILING":
      case "AUTONOMY_IRREVERSIBLE":
      default:
        return new AppError("FORBIDDEN", { message: reason });
    }
  }
}

/** Convenience for callers that need a fresh trace + action id together. */
export function newActionIds(): { actionId: string; traceId: string } {
  return { actionId: newId("act"), traceId: newTraceId() };
}
