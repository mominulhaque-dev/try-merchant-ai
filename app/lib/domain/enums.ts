/**
 * Domain enumerations shared across the app (docs/18 "Enums", docs/26, docs/16).
 *
 * These are plain TypeScript unions + ordered constants so they can be used by
 * both the web and worker tiers with zero dependencies. When the Postgres
 * schema lands (M0.T7) these values MUST stay in lockstep with the Prisma
 * enums of the same name — this file is the application-layer source of truth.
 */

/* ---------------------------------------------------------------- Plans --- */

export const PLAN_TIERS = ["FREE", "GROWTH", "PRO", "SCALE", "ENTERPRISE"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

/** Ascending capability order; higher rank includes lower-tier entitlements. */
const PLAN_RANK: Record<PlanTier, number> = {
  FREE: 0,
  GROWTH: 1,
  PRO: 2,
  SCALE: 3,
  ENTERPRISE: 4,
};
export const planRank = (p: PlanTier): number => PLAN_RANK[p];
/** True when `plan` satisfies the `required` minimum tier. */
export const planSatisfies = (plan: PlanTier, required: PlanTier): boolean =>
  PLAN_RANK[plan] >= PLAN_RANK[required];

/* ------------------------------------------------------ Roles (RBAC) ----- */

export const ROLES = ["OWNER", "ADMIN", "OPERATOR", "ANALYST", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

/** Descending authority mapped to ascending rank for comparison. */
const ROLE_RANK: Record<Role, number> = {
  VIEWER: 0,
  ANALYST: 1,
  OPERATOR: 2,
  ADMIN: 3,
  OWNER: 4,
};
export const roleRank = (r: Role): number => ROLE_RANK[r];
export const roleSatisfies = (role: Role, minRole: Role): boolean =>
  ROLE_RANK[role] >= ROLE_RANK[minRole];

/* ------------------------------------------ Trust ladder (autonomy) ------ */
/* docs/00 P2, docs/16 "Trust ladder".                                       */

export const TRUST_LEVELS = [
  "SUGGEST",
  "DRAFT",
  "APPROVE",
  "AUTO_REVERSIBLE",
  "AUTO_GUARDED",
] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];

const TRUST_RANK: Record<TrustLevel, number> = {
  SUGGEST: 0,
  DRAFT: 1,
  APPROVE: 2,
  AUTO_REVERSIBLE: 3,
  AUTO_GUARDED: 4,
};
export const trustRank = (t: TrustLevel): number => TRUST_RANK[t];
/** True when the configured level is allowed to perform a `required` action. */
export const trustSatisfies = (level: TrustLevel, required: TrustLevel): boolean =>
  TRUST_RANK[level] >= TRUST_RANK[required];
/** Levels at or above this execute without a per-action human approval. */
export const isAutonomous = (t: TrustLevel): boolean =>
  TRUST_RANK[t] >= TRUST_RANK.AUTO_REVERSIBLE;

/* ------------------------------------------------------ Status enums ----- */

export const AGENT_STATUSES = ["IDLE", "RUNNING", "ERROR", "PAUSED"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const SCAN_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
] as const;
export type ScanStatus = (typeof SCAN_STATUSES)[number];

export const SEVERITIES = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const FINDING_STATUSES = [
  "OPEN",
  "DISMISSED",
  "SNOOZED",
  "RESOLVED",
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

export const ACTION_STATUSES = [
  "PENDING",
  "PREVIEWED",
  "APPROVED",
  "EXECUTING",
  "DONE",
  "FAILED",
  "REVERTED",
] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTOR_TYPES = ["AGENT", "HUMAN", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

/** Whether a tool/action reads or mutates store state (docs/16, docs/19). */
export const ACTION_SIDE_EFFECTS = ["read", "mutation"] as const;
export type ActionSideEffect = (typeof ACTION_SIDE_EFFECTS)[number];

/** Insight domains produced by the Store Health scan (docs/14, docs/07 F-01). */
export const FINDING_DOMAINS = [
  "seo",
  "cro",
  "content",
  "catalog",
  "performance",
  "inventory",
] as const;
export type FindingDomain = (typeof FINDING_DOMAINS)[number];
