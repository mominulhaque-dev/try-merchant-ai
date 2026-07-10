/**
 * Agent runtime + safety core (docs/16, docs/00, docs/26, docs/40).
 * The deterministic rails around the probabilistic model (docs/00 P6).
 */
export * from "./types";
export { AGENT_SPECS, ALL_AGENT_SPECS, getAgentSpec } from "./specs";
export { TOOL_CATALOG, getTool, allReferencedScopes } from "./tools";
export {
  checkTool,
  checkAction,
  requiresHumanApproval,
  type PolicyContext,
  type PolicyDecision,
  type PolicyGate,
} from "./policy";
export {
  ActionPipeline,
  newActionIds,
  stableHash,
  type ActionContext,
  type ActionDiff,
  type ActionDiffField,
  type ActionPipelineDeps,
  type ActionRequirementSnapshot,
  type ActionStore,
  type AuditPort,
  type BudgetPort,
  type DiffPort,
  type ExecutorPort,
  type LockPort,
  type PreviewResult,
  type StoredAction,
} from "./action-pipeline.server";
