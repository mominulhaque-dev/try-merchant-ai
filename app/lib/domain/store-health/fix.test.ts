import { describe, it, expect } from "vitest";
import {
  asFixArgs,
  buildFixPlan,
  diffForFix,
  isFixable,
  owningAgent,
  type FixArgs,
} from "./fix";
import {
  previewFinding,
  executeFinding,
  undoFinding,
  listFixState,
  listActivity,
} from "./fix.server";
import type { HealthFinding } from "./types";
import { resolveEntitlements } from "../../security/entitlements.server";
import { assertShop } from "../../security/tenant.server";
import { newTraceId } from "../../ids";

function finding(overrides: Partial<HealthFinding> = {}): HealthFinding {
  return {
    id: "seo-missing-title",
    domain: "seo",
    severity: "HIGH",
    title: "Products missing an SEO title",
    rationale: "Some products have no SEO title.",
    actionType: "product.updateSeo",
    effort: 1,
    affectedCount: 8,
    sampleSize: 20,
    priority: 60,
    ...overrides,
  };
}

describe("fix registry (pure)", () => {
  it("recognizes fixable vs advisory action types", () => {
    expect(isFixable("product.updateSeo")).toBe(true);
    expect(isFixable("image.setAlt")).toBe(true);
    expect(isFixable("product.updateContent")).toBe(true);
    expect(isFixable(null)).toBe(false);
    expect(isFixable("inventory.adjust")).toBe(false);
  });

  it("maps a finding to a gated, reversible proposal from the tool catalog", () => {
    const plan = buildFixPlan(finding());
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.agentId).toBe("seo");
    expect(plan.proposal.type).toBe("product.updateSeo");
    expect(plan.proposal.reversible).toBe(true);
    expect(plan.proposal.requiredTrust).toBe("APPROVE");
    expect(plan.requirement.requiredScopes).toContain("write_products");
    expect(plan.requirement.requiredPlan).toBe("GROWTH");
    expect(plan.requirement.minRole).toBe("OPERATOR");
  });

  it("routes each fixable action to its owning agent", () => {
    expect(owningAgent("product.updateSeo")).toBe("seo");
    expect(owningAgent("image.setAlt")).toBe("seo");
    expect(owningAgent("product.updateContent")).toBe("content");
    expect(buildFixPlan(finding({ id: "c", actionType: "product.updateContent" }))?.agentId).toBe(
      "content",
    );
  });

  it("returns null for advisory findings", () => {
    expect(buildFixPlan(finding({ actionType: null }))).toBeNull();
    expect(buildFixPlan(finding({ actionType: "catalog.noImage" }))).toBeNull();
  });

  it("produces a deterministic diff carrying the affected count", () => {
    const plan = buildFixPlan(finding())!;
    const args = plan.proposal.args as FixArgs;
    const a = diffForFix(args);
    const b = diffForFix(args);
    expect(a).toEqual(b);
    expect(a.itemCount).toBe(8);
    expect(a.summary).toContain("8");
  });

  it("rejects a malformed args bag", () => {
    expect(asFixArgs({ actionType: "nope" })).toBeNull();
    expect(asFixArgs({ actionType: "image.setAlt", findingId: "x" })).toBeNull();
  });
});

describe("fix pipeline (end-to-end, in-memory)", () => {
  const shop = assertShop("fixloop.myshopify.com");
  const entitlements = resolveEntitlements({ scope: "read_products,write_products" });

  it("drives preview → execute → undo and records an audit trail", async () => {
    const f = finding({ id: "e2e-seo-title" });

    const preview = await previewFinding({ shop, entitlements, finding: f, traceId: newTraceId() });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value.requiresApproval).toBe(true);
    const actionId = preview.value.action.id;

    const exec = await executeFinding({
      shop,
      entitlements,
      actionType: "product.updateSeo",
      actionId,
      traceId: newTraceId(),
    });
    expect(exec.ok).toBe(true);
    if (exec.ok) expect(exec.value.status).toBe("DONE");

    const state = await listFixState(shop);
    expect(state["e2e-seo-title"]?.status).toBe("DONE");

    const undo = await undoFinding({
      shop,
      entitlements,
      actionType: "product.updateSeo",
      actionId,
      traceId: newTraceId(),
    });
    expect(undo.ok).toBe(true);
    if (undo.ok) expect(undo.value.status).toBe("REVERTED");

    const events = listActivity(shop).map((a) => a.event);
    expect(events.some((e) => e.startsWith("action.executed"))).toBe(true);
    expect(events.some((e) => e.startsWith("action.reverted"))).toBe(true);
  });

  it("denies a preview when the required scope is missing", async () => {
    const readOnly = resolveEntitlements({ scope: "read_products" });
    const preview = await previewFinding({
      shop,
      entitlements: readOnly,
      finding: finding({ id: "noscope" }),
      traceId: newTraceId(),
    });
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error.code).toBe("SCOPE_MISSING");
  });

  it("refuses to prepare a fix for an advisory finding", async () => {
    const preview = await previewFinding({
      shop,
      entitlements,
      finding: finding({ id: "adv", actionType: null }),
      traceId: newTraceId(),
    });
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error.code).toBe("VALIDATION");
  });
});
