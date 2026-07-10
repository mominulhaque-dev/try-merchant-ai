import { authorize, type AuthzContext } from "../security/authz.server";
import { trustSatisfies, isAutonomous, type TrustLevel } from "../domain/enums";
import type { ActionProposal, AgentSpec, ToolSpec } from "./types";

/**
 * The deterministic policy layer (docs/16 "Policy layer", ADR-016-3; docs/32
 * ADR-032-1). It runs on every proposed tool call and action REGARDLESS of what
 * the model produced, and is authoritative over model output. If any gate fails,
 * the action is blocked with an explained reason — the model can never talk its
 * way past this.
 *
 * This module is pure + synchronous so it is trivially testable and cannot be
 * bypassed by async trickery. Budget/rate/lock checks that need I/O are applied
 * by the runtime around these pure predicates (docs/16, docs/17).
 */

export interface PolicyContext extends AuthzContext {
  /** The agent whose spec constrains what may be called. */
  readonly spec: AgentSpec;
  /** Whether this run is unattended (automation) vs. an interactive request. */
  readonly unattended: boolean;
}

export type PolicyDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string; readonly gate: PolicyGate };

export type PolicyGate =
  | "TOOL_NOT_ALLOWLISTED"
  | "SCOPE"
  | "PLAN"
  | "ROLE"
  | "TRUST"
  | "AUTONOMY_IRREVERSIBLE"
  | "TRUST_CEILING";

function deny(gate: PolicyGate, reason: string): PolicyDecision {
  return { allowed: false, gate, reason };
}

/**
 * Gate a tool invocation. A tool grant is defined by the agent's allowlist
 * (docs/16 "a tool grant is explicit"); read tools still require scope/plan, but
 * do not consult the trust ladder (only mutations do).
 */
export function checkTool(ctx: PolicyContext, tool: ToolSpec): PolicyDecision {
  if (!ctx.spec.tools.includes(tool.name)) {
    return deny(
      "TOOL_NOT_ALLOWLISTED",
      `Agent "${ctx.spec.id}" is not granted tool "${tool.name}".`,
    );
  }

  const decision = authorize(ctx, {
    requiredScopes: tool.requiredScopes,
    requiredPlan: tool.requiredPlan,
    // Reads are permitted to any role that can use the app; mutations tighten
    // the role at the action layer via the proposal's requirements.
    minRole: tool.sideEffect === "mutation" ? "OPERATOR" : "VIEWER",
    // Reads don't gate on trust; mutations are fully gated at checkAction().
    requiredTrust: "SUGGEST",
  });
  if (!decision.allowed) {
    const gate: PolicyGate =
      decision.code === "SCOPE_MISSING"
        ? "SCOPE"
        : decision.code === "PLAN_REQUIRED"
          ? "PLAN"
          : "ROLE";
    return deny(gate, decision.reason);
  }
  return { allowed: true };
}

/**
 * Gate a proposed store mutation before it can be previewed/executed
 * (docs/07 F-02, docs/16, docs/26 four-gate). This enforces:
 *   - the agent's configured trust does not exceed its spec ceiling;
 *   - irreversible actions never auto-execute below AUTO_GUARDED (docs/00 P2);
 *   - the full four-gate authorization for the action's requirements.
 */
export function checkAction(
  ctx: PolicyContext,
  proposal: ActionProposal,
  requirement: {
    requiredScopes: readonly string[];
    requiredPlan: PolicyContext["plan"];
    minRole: PolicyContext["role"];
  },
): PolicyDecision {
  // The agent can never be configured above its spec's ceiling.
  if (!trustSatisfies(ctx.spec.maxTrustLevel, ctx.agentTrust)) {
    return deny(
      "TRUST_CEILING",
      `Configured trust "${ctx.agentTrust}" exceeds the ceiling for agent "${ctx.spec.id}".`,
    );
  }

  // Irreversible actions must never auto-execute below the guarded level.
  if (
    !proposal.reversible &&
    ctx.unattended &&
    !trustSatisfies(ctx.agentTrust, "AUTO_GUARDED")
  ) {
    return deny(
      "AUTONOMY_IRREVERSIBLE",
      "Irreversible action cannot run unattended below AUTO_GUARDED autonomy; explicit confirmation required.",
    );
  }

  const decision = authorize(ctx, {
    requiredScopes: requirement.requiredScopes,
    requiredPlan: requirement.requiredPlan,
    minRole: requirement.minRole,
    requiredTrust: proposal.requiredTrust,
  });
  if (!decision.allowed) {
    const gate: PolicyGate =
      decision.code === "SCOPE_MISSING"
        ? "SCOPE"
        : decision.code === "PLAN_REQUIRED"
          ? "PLAN"
          : "ROLE";
    // A trust shortfall surfaces through the authorize() role/trust gate; map it.
    if (!trustSatisfies(ctx.agentTrust, proposal.requiredTrust)) {
      return deny("TRUST", decision.reason);
    }
    return deny(gate, decision.reason);
  }

  return { allowed: true };
}

/**
 * Whether this proposal, given the agent's trust level and attended/unattended
 * mode, requires an explicit human approval before execution (docs/00 P2).
 * Attended requests always confirm below AUTO_REVERSIBLE; unattended runs rely
 * on the configured autonomy.
 */
export function requiresHumanApproval(
  agentTrust: TrustLevel,
  proposal: ActionProposal,
  unattended: boolean,
): boolean {
  if (!proposal.reversible) {
    // Irreversible: only AUTO_GUARDED may skip a confirmation, and only when
    // explicitly unattended automation. Everything else confirms.
    return !(unattended && trustSatisfies(agentTrust, "AUTO_GUARDED"));
  }
  if (isAutonomous(agentTrust)) return false;
  return true;
}
