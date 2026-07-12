import type {
  ActionSideEffect,
  PlanTier,
  TrustLevel,
} from "../domain/enums";

/**
 * Agent runtime contracts (docs/16 "Agent Runtime", docs/19 "Agent Tool API").
 *
 * These are declarative types only — the shared runtime, policy layer, and tool
 * catalog (M1) are configured entirely by an {@link AgentSpec}, so there are no
 * bespoke per-agent frameworks (ADR-016-1). Runtime validation (Zod schemas on
 * tool inputs/outputs) is attached at the tool-catalog milestone; kept as an
 * opaque `unknown` validator slot here to avoid a premature dependency (C-3).
 */

/** The twelve first-party agents (docs/16 "The 12 agents"). */
export type AgentId =
  | "store_health"
  | "seo"
  | "cro"
  | "marketing"
  | "analytics"
  | "inventory"
  | "support"
  | "content"
  | "email"
  | "workflow"
  | "theme"
  | "recommendation";

export const AGENT_IDS: readonly AgentId[] = [
  "store_health",
  "seo",
  "cro",
  "marketing",
  "analytics",
  "inventory",
  "support",
  "content",
  "email",
  "workflow",
  "theme",
  "recommendation",
] as const;

export type ModelProvider =
  | "anthropic"
  | "openai"
  | "google"
  | "qwen"
  | "huggingface";

export interface ModelRef {
  readonly provider: ModelProvider;
  /** Provider model id, e.g. an Anthropic Claude model (docs/16 ADR-016). */
  readonly model: string;
}

/** Cost + rate ceilings enforced by the runtime per task (docs/00 P7, docs/16). */
export interface AgentBudget {
  readonly maxTokensPerTask: number;
  readonly maxCallsPerTask: number;
  /** Daily AI Action Credit budget for this agent on a shop (docs/27). */
  readonly dailyAAC: number;
}

/** Which memory regions an agent may read/write (docs/31). */
export interface MemoryScope {
  readonly read: readonly (AgentId | "shop")[];
  readonly write: readonly (AgentId | "shop")[];
}

/**
 * A typed tool an agent may call (docs/19 "Agent Tool API"). Read tools execute
 * directly (rate-limited); mutation tools return a proposed action that must
 * pass through the action pipeline — never a direct write from the model
 * (ADR-016-2). `validateInput`/`validateOutput` are populated with Zod schemas
 * at the tool-catalog milestone.
 */
export interface ToolSpec<Input = unknown, Output = unknown> {
  readonly name: string;
  readonly description: string;
  readonly sideEffect: ActionSideEffect;
  readonly requiredScopes: readonly string[];
  readonly requiredPlan: PlanTier;
  /** AI Action Credit cost charged when this tool runs (docs/27). */
  readonly costAAC: number;
  readonly validateInput?: (raw: unknown) => Input;
  readonly validateOutput?: (raw: unknown) => Output;
}

/** The declarative definition that configures one agent instance (docs/16). */
export interface AgentSpec {
  readonly id: AgentId;
  readonly displayName: string;
  readonly responsibilities: readonly string[];
  /** Explicit non-goals — the runtime refuses work outside this (docs/16). */
  readonly outOfScope: readonly string[];
  readonly systemPrompt: string;
  /** Allowlist of tool names; grants are code, not prose (docs/16, docs/19). */
  readonly tools: readonly string[];
  readonly memoryScope: MemoryScope;
  /** New capabilities enter at SUGGEST and graduate deliberately (docs/00 P2). */
  readonly defaultTrustLevel: TrustLevel;
  readonly maxTrustLevel: TrustLevel;
  readonly budget: AgentBudget;
  readonly model: {
    readonly primary: ModelRef;
    readonly fallback: ModelRef;
    readonly cheap: ModelRef;
  };
}

/**
 * A proposed store mutation emitted by a mutation tool (docs/07 F-02, docs/16).
 * It is previewed and gated by the action pipeline before any write.
 */
export interface ActionProposal<Args = Record<string, unknown>> {
  /** Typed action id, e.g. `product.updateSeoTitle`. */
  readonly type: string;
  readonly args: Args;
  /** Whether the pipeline can automatically undo this action (docs/40). */
  readonly reversible: boolean;
  /** Human-readable summary of the effect, shown in the preview (docs/11). */
  readonly summary: string;
  /** Trust level required to execute (combined with authz gates, docs/26). */
  readonly requiredTrust: TrustLevel;
}
