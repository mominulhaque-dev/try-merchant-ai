import type { ToolSpec } from "./types";

/**
 * The agent tool catalog (docs/19 "Agent Tool API"). Each tool declares its
 * side-effect, the Shopify scopes it needs (docs/26 scope registry), the plan
 * that unlocks it (docs/27), and its AAC cost (docs/27 metering). Agents may
 * only call tools listed in their {@link AgentSpec.tools} allowlist, enforced by
 * the policy layer (docs/16).
 *
 * Read tools execute directly (rate-limited); mutation tools return an
 * {@link ActionProposal} that must pass the action pipeline — never a direct
 * write from the model (ADR-016-2). Zod input/output validators are attached
 * with the concrete Shopify implementations at the tool-implementation milestone
 * (C-3); the contracts here are stable.
 */

function tool(spec: ToolSpec): ToolSpec {
  return spec;
}

export const TOOL_CATALOG: Record<string, ToolSpec> = {
  // --- Reads -------------------------------------------------------------
  "products.list": tool({
    name: "products.list",
    description: "List products with pagination for auditing and analysis.",
    sideEffect: "read",
    requiredScopes: ["read_products"],
    requiredPlan: "FREE",
    costAAC: 1,
  }),
  "product.get": tool({
    name: "product.get",
    description: "Fetch a single product with variants, media, and SEO fields.",
    sideEffect: "read",
    requiredScopes: ["read_products"],
    requiredPlan: "FREE",
    costAAC: 1,
  }),
  "orders.summary": tool({
    name: "orders.summary",
    description: "Aggregate order metrics (revenue, AOV, velocity) over a window.",
    sideEffect: "read",
    requiredScopes: ["read_orders"],
    requiredPlan: "GROWTH",
    costAAC: 1,
  }),
  "inventory.risk": tool({
    name: "inventory.risk",
    description: "Compute stockout/overstock risk from inventory levels and velocity.",
    sideEffect: "read",
    requiredScopes: ["read_inventory", "read_orders"],
    requiredPlan: "PRO",
    costAAC: 2,
  }),
  "theme.get": tool({
    name: "theme.get",
    description: "Read the published theme's structure and performance signals.",
    sideEffect: "read",
    requiredScopes: ["read_themes"],
    requiredPlan: "GROWTH",
    costAAC: 1,
  }),
  "analytics.metric": tool({
    name: "analytics.metric",
    description: "Read a computed analytics metric or trend for the shop.",
    sideEffect: "read",
    requiredScopes: ["read_orders"],
    requiredPlan: "GROWTH",
    costAAC: 1,
  }),
  "policies.get": tool({
    name: "policies.get",
    description: "Read shop policies (returns, shipping) for grounded support replies.",
    sideEffect: "read",
    requiredScopes: [],
    requiredPlan: "PRO",
    costAAC: 1,
  }),

  // --- Mutations (routed through the action pipeline) --------------------
  "product.updateSeo": tool({
    name: "product.updateSeo",
    description: "Propose an update to a product's SEO title and meta description.",
    sideEffect: "mutation",
    requiredScopes: ["write_products"],
    requiredPlan: "GROWTH",
    costAAC: 2,
  }),
  "image.setAlt": tool({
    name: "image.setAlt",
    description: "Propose alt text for product media that is missing it.",
    sideEffect: "mutation",
    requiredScopes: ["write_products"],
    requiredPlan: "GROWTH",
    costAAC: 1,
  }),
  "redirect.create": tool({
    name: "redirect.create",
    description: "Propose a URL redirect (e.g. after a handle change) to avoid 404s.",
    sideEffect: "mutation",
    requiredScopes: ["write_content"],
    requiredPlan: "GROWTH",
    costAAC: 1,
  }),
  "product.updateContent": tool({
    name: "product.updateContent",
    description: "Propose brand-consistent product description/copy edits.",
    sideEffect: "mutation",
    requiredScopes: ["write_products"],
    requiredPlan: "GROWTH",
    costAAC: 3,
  }),
  "blog.draft": tool({
    name: "blog.draft",
    description: "Propose a blog article draft grounded in catalog and brand voice.",
    sideEffect: "mutation",
    requiredScopes: ["write_content"],
    requiredPlan: "GROWTH",
    costAAC: 3,
  }),
  "experiment.configure": tool({
    name: "experiment.configure",
    description: "Propose an A/B experiment configuration for a storefront block.",
    sideEffect: "mutation",
    requiredScopes: ["write_themes"],
    requiredPlan: "GROWTH",
    costAAC: 2,
  }),
  "inventory.adjust": tool({
    name: "inventory.adjust",
    description: "Propose an inventory quantity adjustment (gated, previewed).",
    sideEffect: "mutation",
    requiredScopes: ["write_inventory"],
    requiredPlan: "PRO",
    costAAC: 2,
  }),
  "support.draftReply": tool({
    name: "support.draftReply",
    description: "Draft a customer support reply for human review.",
    sideEffect: "mutation",
    requiredScopes: ["read_customers"],
    requiredPlan: "PRO",
    costAAC: 2,
  }),
  "campaign.propose": tool({
    name: "campaign.propose",
    description: "Propose a marketing campaign plan for approval.",
    sideEffect: "mutation",
    requiredScopes: [],
    requiredPlan: "PRO",
    costAAC: 2,
  }),
  "email.draftCampaign": tool({
    name: "email.draftCampaign",
    description: "Draft an email campaign; full-list sends require explicit approval.",
    sideEffect: "mutation",
    requiredScopes: [],
    requiredPlan: "PRO",
    costAAC: 3,
  }),
  "report.build": tool({
    name: "report.build",
    description: "Build a report artifact from precomputed analytics.",
    sideEffect: "mutation",
    requiredScopes: ["read_orders"],
    requiredPlan: "GROWTH",
    costAAC: 2,
  }),
  "recommendation.configure": tool({
    name: "recommendation.configure",
    description: "Propose recommendation logic for storefront blocks.",
    sideEffect: "mutation",
    requiredScopes: ["read_products", "read_orders"],
    requiredPlan: "PRO",
    costAAC: 2,
  }),
  "automation.create": tool({
    name: "automation.create",
    description: "Propose a new automation (trigger + task + guardrails).",
    sideEffect: "mutation",
    requiredScopes: [],
    requiredPlan: "SCALE",
    costAAC: 1,
  }),
  "automation.update": tool({
    name: "automation.update",
    description: "Propose changes to an existing automation.",
    sideEffect: "mutation",
    requiredScopes: [],
    requiredPlan: "SCALE",
    costAAC: 1,
  }),
  "themeBlock.configure": tool({
    name: "themeBlock.configure",
    description: "Propose theme app block placement/settings (no raw theme edits).",
    sideEffect: "mutation",
    requiredScopes: ["write_themes"],
    requiredPlan: "SCALE",
    costAAC: 2,
  }),
};

export function getTool(name: string): ToolSpec | undefined {
  return TOOL_CATALOG[name];
}

/** All Shopify scopes referenced by the catalog (docs/26 least-privilege audit). */
export function allReferencedScopes(): string[] {
  const set = new Set<string>();
  for (const spec of Object.values(TOOL_CATALOG)) {
    for (const scope of spec.requiredScopes) set.add(scope);
  }
  return [...set].sort();
}
