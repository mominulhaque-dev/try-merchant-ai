import { AppError, err, type Result } from "../../errors";
import { logger } from "../../telemetry/logger.server";
import type { Shop } from "../../security/tenant.server";
import type { Entitlements } from "../../security/entitlements.server";
import type { ActorType } from "../enums";
import { AGENT_SPECS } from "../../agents/specs";
import {
  ActionPipeline,
  type ActionContext,
  type ActionDiff,
  type DiffPort,
  type ExecutorPort,
  type PreviewResult,
  type StoredAction,
} from "../../agents/action-pipeline.server";
import {
  InMemoryActionStore,
  InMemoryAuditLog,
  InMemoryBudget,
  KeyedMutexLock,
  type AuditRecord,
} from "../../agents/adapters/in-memory.server";
import type { HealthFinding } from "./types";
import {
  asFixArgs,
  buildFixPlan,
  diffForFix,
  owningAgent,
  type FixableActionType,
} from "./fix";

/**
 * The runnable "Fix it" wiring (docs/07 F-02, docs/14, M1.T7).
 *
 * It composes the deterministic action pipeline with the process-lifetime
 * in-memory adapters so the merchant can drive a store-health finding through
 * the full reversibility spine — preview → approve → execute → undo — before the
 * Postgres + Redis cutover (M0.T7). The pieces that reach Shopify (the diff and
 * executor) are the only things that are simulated here: they draft and record
 * the intended change rather than writing to the live store. The concrete
 * Shopify adapters swap into these exact ports at the tool-implementation
 * milestone with no change to the orchestration, policy, audit, or UI.
 */

/* ---------------------------------------------------------------- Ports --- */

/** Computes the fix diff purely from the proposal args (deterministic). */
class FixDiffPort implements DiffPort {
  async compute(
    proposal: { args: Record<string, unknown> },
  ): Promise<ActionDiff> {
    const args = asFixArgs(proposal.args);
    if (!args) {
      throw new AppError("VALIDATION", {
        message: "This fix can no longer be prepared. Re-run the scan and try again.",
        details: { reason: "invalid_fix_args" },
      });
    }
    return diffForFix(args);
  }
}

/**
 * Simulated executor: it records the intended, reversible draft without writing
 * to Shopify. This keeps the loop honest end-to-end (audit + undo token are
 * real) while the Shopify write adapter — which performs and truly reverses the
 * change — lands later behind this same port.
 */
class SimulatedFixExecutor implements ExecutorPort {
  async apply(action: StoredAction): Promise<{ afterState: unknown; undoToken?: string }> {
    const args = asFixArgs(action.args);
    return {
      afterState: {
        simulated: true,
        actionType: args?.actionType ?? action.type,
        itemCount: args?.affectedCount ?? action.args["affectedCount"] ?? null,
        note: "Drafted in-app; the live store write runs when the Shopify executor is enabled.",
      },
      undoToken: `undo:${action.id}`,
    };
  }

  async revert(): Promise<void> {
    // Nothing was written to Shopify, so there is nothing to reverse. The
    // pipeline still records the reversal in the audit trail. The real Shopify
    // executor restores the captured before-state here.
  }
}

/* ------------------------------------------------------- Pipeline (singleton) */

interface FixRuntime {
  readonly pipeline: ActionPipeline;
  readonly store: InMemoryActionStore;
  readonly audit: InMemoryAuditLog;
  readonly budget: InMemoryBudget;
}

let runtime: FixRuntime | undefined;

function getRuntime(): FixRuntime {
  if (runtime) return runtime;
  const store = new InMemoryActionStore();
  const audit = new InMemoryAuditLog();
  const budget = new InMemoryBudget();
  const pipeline = new ActionPipeline({
    store,
    diff: new FixDiffPort(),
    executor: new SimulatedFixExecutor(),
    audit,
    lock: new KeyedMutexLock(),
    budget,
    logger: logger.child({ service: "store-health-fix" }),
  });
  runtime = { pipeline, store, audit, budget };
  return runtime;
}

/* ---------------------------------------------------------------- Context - */

function buildContext(input: {
  shop: Shop;
  entitlements: Entitlements;
  agentId: keyof typeof AGENT_SPECS;
  traceId: string;
  actorType?: ActorType;
}): ActionContext {
  return {
    shop: input.shop,
    actorType: input.actorType ?? "HUMAN",
    traceId: input.traceId,
    spec: AGENT_SPECS[input.agentId],
    unattended: false,
    grantedScopes: input.entitlements.grantedScopes,
    plan: input.entitlements.plan,
    role: input.entitlements.role,
    // Fixes run at APPROVE: reversible, but always human-confirmed via preview.
    agentTrust: "APPROVE",
  };
}

/* ------------------------------------------------------- Public operations - */

export async function previewFinding(input: {
  shop: Shop;
  entitlements: Entitlements;
  finding: HealthFinding;
  traceId: string;
}): Promise<Result<PreviewResult>> {
  const plan = buildFixPlan(input.finding);
  if (!plan) {
    return err(
      new AppError("VALIDATION", {
        message: "This finding is advisory and has no automated fix.",
        traceId: input.traceId,
        details: { findingId: input.finding.id },
      }),
    );
  }
  const ctx = buildContext({
    shop: input.shop,
    entitlements: input.entitlements,
    agentId: plan.agentId,
    traceId: input.traceId,
  });
  return getRuntime().pipeline.preview(
    ctx,
    plan.proposal,
    AGENT_SPECS[plan.agentId],
    plan.requirement,
  );
}

export async function executeFinding(input: {
  shop: Shop;
  entitlements: Entitlements;
  actionType: FixableActionType;
  actionId: string;
  traceId: string;
}): Promise<Result<StoredAction>> {
  const ctx = buildContext({
    shop: input.shop,
    entitlements: input.entitlements,
    agentId: owningAgent(input.actionType),
    traceId: input.traceId,
  });
  return getRuntime().pipeline.execute(ctx, input.actionId);
}

export async function undoFinding(input: {
  shop: Shop;
  entitlements: Entitlements;
  actionType: FixableActionType;
  actionId: string;
  traceId: string;
}): Promise<Result<StoredAction>> {
  const ctx = buildContext({
    shop: input.shop,
    entitlements: input.entitlements,
    agentId: owningAgent(input.actionType),
    traceId: input.traceId,
  });
  return getRuntime().pipeline.undo(ctx, input.actionId);
}

/* ------------------------------------------------------------ UI read side - */

export interface FixState {
  readonly actionId: string;
  readonly status: StoredAction["status"];
  readonly diffSummary: string;
}

/** Latest fix state per finding for a shop, so a reload reflects prior actions. */
export async function listFixState(shop: Shop): Promise<Record<string, FixState>> {
  const actions = await getRuntime().store.list(shop);
  const byFinding: Record<string, FixState> = {};
  for (const action of actions) {
    const args = asFixArgs(action.args);
    if (!args) continue;
    // Map insertion order is chronological, so the last write wins.
    byFinding[args.findingId] = {
      actionId: action.id,
      status: action.status,
      diffSummary: diffForFix(args).summary,
    };
  }
  return byFinding;
}

export interface ActivityEntry {
  readonly seq: number;
  readonly event: string;
  readonly target?: string;
  readonly traceId: string;
}

/** Recent audit activity for a shop, mapped to a compact, serializable shape. */
export function listActivity(shop: string, limit = 12): ActivityEntry[] {
  return getRuntime()
    .audit.list(shop, limit)
    .map((r: AuditRecord) => ({
      seq: r.seq,
      event: r.event,
      target: r.target,
      traceId: r.traceId,
    }));
}

/** Credits consumed by the shop's fixes so far this process (for the UI). */
export function usedCredits(shop: string): number {
  return getRuntime().budget.used(shop);
}
