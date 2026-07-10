import { AppError, type ErrorCode } from "../errors";
import {
  planSatisfies,
  roleSatisfies,
  trustSatisfies,
  type PlanTier,
  type Role,
  type TrustLevel,
} from "../domain/enums";

/**
 * Four-gate authorization for every mutating action (docs/26 "Trust ladder
 * gate", ADR-026-1). An action executes only if ALL hold:
 *   1. Shopify scope present   (app ↔ store)
 *   2. Plan entitlement met    (billing ↔ features)
 *   3. User role permits       (user ↔ app, RBAC)
 *   4. Agent trust level allows (autonomy ladder)
 *
 * The check is deterministic and server-side; it is authoritative over any AI
 * proposal (docs/16, docs/32 ADR-032-1). Returns the first failing gate with a
 * mapped error code so the caller can respond precisely (re-auth, upsell, etc.).
 */

export interface AuthzContext {
  readonly grantedScopes: readonly string[];
  readonly plan: PlanTier;
  readonly role: Role;
  /** The agent's currently configured autonomy level. */
  readonly agentTrust: TrustLevel;
}

export interface ActionRequirement {
  readonly requiredScopes: readonly string[];
  readonly requiredPlan: PlanTier;
  readonly minRole: Role;
  /** Minimum trust level at which this action may run unattended/at all. */
  readonly requiredTrust: TrustLevel;
}

export type AuthzDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly code: ErrorCode;
      readonly reason: string;
      /** For SCOPE_MISSING: which scopes were absent. */
      readonly missingScopes?: readonly string[];
    };

export function authorize(
  ctx: AuthzContext,
  req: ActionRequirement,
): AuthzDecision {
  // Gate 1 — Shopify scopes.
  const missingScopes = req.requiredScopes.filter(
    (s) => !ctx.grantedScopes.includes(s),
  );
  if (missingScopes.length > 0) {
    return {
      allowed: false,
      code: "SCOPE_MISSING",
      reason: `Missing Shopify scope(s): ${missingScopes.join(", ")}`,
      missingScopes,
    };
  }

  // Gate 2 — Plan entitlement.
  if (!planSatisfies(ctx.plan, req.requiredPlan)) {
    return {
      allowed: false,
      code: "PLAN_REQUIRED",
      reason: `Requires the ${req.requiredPlan} plan or higher.`,
    };
  }

  // Gate 3 — RBAC role.
  if (!roleSatisfies(ctx.role, req.minRole)) {
    return {
      allowed: false,
      code: "FORBIDDEN",
      reason: `Requires the ${req.minRole} role or higher.`,
    };
  }

  // Gate 4 — Autonomy / trust ladder.
  if (!trustSatisfies(ctx.agentTrust, req.requiredTrust)) {
    return {
      allowed: false,
      code: "FORBIDDEN",
      reason: `Agent autonomy (${ctx.agentTrust}) is below the required ${req.requiredTrust}.`,
    };
  }

  return { allowed: true };
}

/**
 * Authorize or throw the mapped AppError — for call sites that prefer the
 * throwing style (routes/pipeline). Preserves the failing reason in `details`
 * without leaking anything unsafe.
 */
export function assertAuthorized(
  ctx: AuthzContext,
  req: ActionRequirement,
): void {
  const decision = authorize(ctx, req);
  if (!decision.allowed) {
    throw new AppError(decision.code, {
      message: decision.reason,
      details: decision.missingScopes
        ? { missingScopes: decision.missingScopes }
        : undefined,
    });
  }
}
