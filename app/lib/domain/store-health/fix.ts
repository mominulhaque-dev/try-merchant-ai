import type { FindingDomain } from "../enums";
import type { HealthFinding } from "./types";
import type { AgentId, ActionProposal } from "../../agents/types";
import type {
  ActionDiff,
  ActionRequirementSnapshot,
} from "../../agents/action-pipeline.server";
import { TOOL_CATALOG } from "../../agents/tools";

/**
 * Store-Health fix registry (docs/07 F-02, docs/14, docs/16).
 *
 * Pure glue that turns an explainable {@link HealthFinding} into a typed,
 * gated, reversible {@link ActionProposal} the action pipeline can preview and
 * execute — the "Fix it" spine. It is deterministic and dependency-free (no I/O,
 * no clock), so the same finding always produces the same proposal + diff and it
 * unit-tests without a network or DB.
 *
 * A finding maps to a fix only when its recommended `actionType` is a mutation
 * tool we can safely draft. Advisory-only findings (e.g. "product has no image")
 * have no automated fix and return null here; the UI shows them as guidance.
 */

/** The subset of tool-catalog mutations the Fix-it flow can currently draft. */
export const FIXABLE_ACTION_TYPES = [
  "product.updateSeo",
  "image.setAlt",
  "product.updateContent",
] as const;

export type FixableActionType = (typeof FIXABLE_ACTION_TYPES)[number];

/** Which first-party agent owns (and is accountable for) each fix. */
const OWNING_AGENT: Record<FixableActionType, AgentId> = {
  "product.updateSeo": "seo",
  "image.setAlt": "seo",
  "product.updateContent": "content",
};

interface FixCopy {
  /** Short noun for the artifact being drafted, e.g. "SEO metadata". */
  readonly artifact: string;
  /** Imperative summary of the proposed bulk change. */
  readonly verb: string;
}

const FIX_COPY: Record<FixableActionType, FixCopy> = {
  "product.updateSeo": {
    artifact: "SEO metadata",
    verb: "Draft SEO titles and meta descriptions",
  },
  "image.setAlt": {
    artifact: "image alt text",
    verb: "Draft descriptive alt text for product images",
  },
  "product.updateContent": {
    artifact: "product descriptions",
    verb: "Expand thin product descriptions",
  },
};

export function isFixable(actionType: string | null): actionType is FixableActionType {
  return actionType !== null &&
    (FIXABLE_ACTION_TYPES as readonly string[]).includes(actionType);
}

/**
 * The serializable arguments carried on the proposal. They fully determine the
 * diff (so `preview` and `execute` recompute an identical hash for optimistic
 * concurrency) and are safe to round-trip through a form post.
 */
export interface FixArgs extends Record<string, unknown> {
  readonly findingId: string;
  readonly actionType: FixableActionType;
  readonly domain: FindingDomain;
  readonly title: string;
  readonly affectedCount: number;
  readonly sampleSize: number;
}

/** Narrow an untrusted args bag (e.g. from a stored action) to {@link FixArgs}. */
export function asFixArgs(raw: Record<string, unknown>): FixArgs | null {
  const actionType = raw["actionType"];
  if (typeof actionType !== "string" || !isFixable(actionType)) return null;
  const findingId = raw["findingId"];
  const domain = raw["domain"];
  const title = raw["title"];
  const affectedCount = raw["affectedCount"];
  const sampleSize = raw["sampleSize"];
  if (
    typeof findingId !== "string" ||
    typeof domain !== "string" ||
    typeof title !== "string" ||
    typeof affectedCount !== "number" ||
    typeof sampleSize !== "number"
  ) {
    return null;
  }
  return {
    findingId,
    actionType,
    domain: domain as FindingDomain,
    title,
    affectedCount,
    sampleSize,
  };
}

/** Human-readable summary of the proposed bulk fix. */
export function fixSummary(args: FixArgs): string {
  const copy = FIX_COPY[args.actionType];
  const noun = args.affectedCount === 1 ? "product" : "products";
  return `${copy.verb} for ${args.affectedCount} ${noun}`;
}

/**
 * A deterministic, explainable diff for the proposed bulk fix. It is derived
 * purely from {@link FixArgs}, so the pipeline's optimistic-concurrency hash is
 * stable between preview and execute for the same finding.
 */
export function diffForFix(args: FixArgs): ActionDiff {
  const copy = FIX_COPY[args.actionType];
  const noun = args.affectedCount === 1 ? "product" : "products";
  return {
    fields: [
      {
        key: args.actionType,
        before: `${args.affectedCount} ${noun} missing ${copy.artifact}`,
        after: `AI-drafted ${copy.artifact} prepared for ${args.affectedCount} ${noun}, pending your approval`,
      },
    ],
    summary: fixSummary(args),
    itemCount: args.affectedCount,
  };
}

/** The four-gate requirement snapshot for a fix, sourced from the tool catalog. */
export function fixRequirement(actionType: FixableActionType): ActionRequirementSnapshot {
  const tool = TOOL_CATALOG[actionType];
  return {
    requiredScopes: tool.requiredScopes,
    requiredPlan: tool.requiredPlan,
    // Store mutations require an operator; reversible drafts execute at APPROVE.
    minRole: "OPERATOR",
    requiredTrust: "APPROVE",
  };
}

export interface FixPlan {
  readonly agentId: AgentId;
  readonly proposal: ActionProposal<FixArgs>;
  readonly requirement: ActionRequirementSnapshot;
}

/**
 * Build the full fix plan for a finding, or null when the finding is advisory
 * only. Fixes are reversible and require explicit human approval (APPROVE), so
 * nothing mutates the store without the merchant confirming the preview.
 */
export function buildFixPlan(finding: HealthFinding): FixPlan | null {
  if (!isFixable(finding.actionType)) return null;
  const args: FixArgs = {
    findingId: finding.id,
    actionType: finding.actionType,
    domain: finding.domain,
    title: finding.title,
    affectedCount: finding.affectedCount,
    sampleSize: finding.sampleSize,
  };
  return {
    agentId: OWNING_AGENT[finding.actionType],
    proposal: {
      type: finding.actionType,
      args,
      reversible: true,
      summary: fixSummary(args),
      requiredTrust: "APPROVE",
    },
    requirement: fixRequirement(finding.actionType),
  };
}

/** The owning agent for a fixable action type (for rebuilding execute context). */
export function owningAgent(actionType: FixableActionType): AgentId {
  return OWNING_AGENT[actionType];
}
