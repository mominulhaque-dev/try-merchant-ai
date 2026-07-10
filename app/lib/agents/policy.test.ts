import { describe, it, expect } from "vitest";
import { checkTool, checkAction, requiresHumanApproval, type PolicyContext } from "./policy";
import { AGENT_SPECS } from "./specs";
import { TOOL_CATALOG } from "./tools";
import type { ActionProposal } from "./types";

const baseCtx: PolicyContext = {
  grantedScopes: ["read_products", "write_products"],
  plan: "GROWTH",
  role: "OPERATOR",
  agentTrust: "APPROVE",
  spec: AGENT_SPECS.seo,
  unattended: false,
};

const reversible: ActionProposal = {
  type: "product.updateSeo",
  args: { id: "gid://shopify/Product/1" },
  reversible: true,
  summary: "Update SEO title",
  requiredTrust: "APPROVE",
};

const requirement = {
  requiredScopes: ["write_products"],
  requiredPlan: "GROWTH" as const,
  minRole: "OPERATOR" as const,
};

describe("checkTool", () => {
  it("allows an allowlisted read tool with scope", () => {
    expect(checkTool(baseCtx, TOOL_CATALOG["product.get"]).allowed).toBe(true);
  });

  it("blocks a tool not in the agent allowlist", () => {
    const d = checkTool(baseCtx, TOOL_CATALOG["orders.summary"]);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("TOOL_NOT_ALLOWLISTED");
  });

  it("blocks when the required Shopify scope is missing", () => {
    const d = checkTool({ ...baseCtx, grantedScopes: [] }, TOOL_CATALOG["product.get"]);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("SCOPE");
  });
});

describe("checkAction — four gates + autonomy", () => {
  it("allows a properly authorized reversible action", () => {
    expect(checkAction(baseCtx, reversible, requirement).allowed).toBe(true);
  });

  it("blocks when agent trust is below the action requirement", () => {
    const d = checkAction({ ...baseCtx, agentTrust: "SUGGEST" }, reversible, requirement);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("TRUST");
  });

  it("blocks when configured trust exceeds the agent's spec ceiling", () => {
    const d = checkAction({ ...baseCtx, agentTrust: "AUTO_GUARDED" }, reversible, requirement);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("TRUST_CEILING");
  });

  it("blocks irreversible unattended actions below AUTO_GUARDED", () => {
    const d = checkAction(
      { ...baseCtx, agentTrust: "AUTO_REVERSIBLE", unattended: true },
      { ...reversible, reversible: false },
      requirement,
    );
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("AUTONOMY_IRREVERSIBLE");
  });

  it("blocks when the plan does not entitle the action", () => {
    const d = checkAction({ ...baseCtx, plan: "FREE" }, reversible, requirement);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.gate).toBe("PLAN");
  });
});

describe("requiresHumanApproval", () => {
  it("requires approval for reversible actions below AUTO", () => {
    expect(requiresHumanApproval("APPROVE", reversible, false)).toBe(true);
  });
  it("skips approval for reversible actions at AUTO_REVERSIBLE", () => {
    expect(requiresHumanApproval("AUTO_REVERSIBLE", reversible, false)).toBe(false);
  });
  it("requires approval for irreversible actions unless guarded+unattended", () => {
    const irreversible = { ...reversible, reversible: false };
    expect(requiresHumanApproval("AUTO_REVERSIBLE", irreversible, true)).toBe(true);
    expect(requiresHumanApproval("AUTO_GUARDED", irreversible, true)).toBe(false);
  });
});
