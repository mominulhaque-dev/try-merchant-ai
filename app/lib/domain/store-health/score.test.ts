import { describe, it, expect } from "vitest";
import { scoreSnapshot } from "./score";
import type { ProductSnapshot, StoreSnapshot } from "./types";

const CAPTURED_AT = "2026-07-10T00:00:00.000Z";

/** A fully healthy product — passes every check. */
function healthyProduct(overrides: Partial<ProductSnapshot> = {}): ProductSnapshot {
  return {
    id: "gid://shopify/Product/1",
    title: "Great Product",
    handle: "great-product",
    status: "ACTIVE",
    descriptionLength: 800,
    hasSeoTitle: true,
    hasSeoDescription: true,
    imageCount: 3,
    imagesMissingAlt: 0,
    totalInventory: 25,
    variantCount: 2,
    ...overrides,
  };
}

function snapshot(products: ProductSnapshot[]): StoreSnapshot {
  return {
    shopDomain: "example.myshopify.com",
    totalProducts: products.length,
    products,
    capturedAt: CAPTURED_AT,
  };
}

describe("scoreSnapshot", () => {
  it("gives a perfect score and no findings for a fully healthy sample", () => {
    const report = scoreSnapshot(snapshot([healthyProduct(), healthyProduct()]));
    expect(report.overallScore).toBe(100);
    expect(report.findings).toHaveLength(0);
    expect(report.sampleSize).toBe(2);
  });

  it("returns 100 with no findings for an empty catalog (nothing to penalize)", () => {
    const report = scoreSnapshot(snapshot([]));
    expect(report.overallScore).toBe(100);
    expect(report.findings).toHaveLength(0);
  });

  it("flags missing SEO title and meta description as findings", () => {
    const report = scoreSnapshot(
      snapshot([healthyProduct({ hasSeoTitle: false, hasSeoDescription: false })]),
    );
    const ids = report.findings.map((f) => f.id);
    expect(ids).toContain("seo-missing-title");
    expect(ids).toContain("seo-missing-meta");
    expect(report.overallScore).toBeLessThan(100);
  });

  it("maps a universal issue to CRITICAL severity", () => {
    const report = scoreSnapshot(
      snapshot([
        healthyProduct({ hasSeoTitle: false }),
        healthyProduct({ id: "gid://shopify/Product/2", hasSeoTitle: false }),
      ]),
    );
    const finding = report.findings.find((f) => f.id === "seo-missing-title");
    expect(finding?.severity).toBe("CRITICAL");
    expect(finding?.affectedCount).toBe(2);
    expect(finding?.sampleSize).toBe(2);
  });

  it("flags active out-of-stock products but ignores tracked-null inventory", () => {
    const report = scoreSnapshot(
      snapshot([
        healthyProduct({ totalInventory: 0 }),
        healthyProduct({ id: "gid://shopify/Product/2", totalInventory: null }),
      ]),
    );
    const finding = report.findings.find((f) => f.id === "inventory-out-of-stock");
    expect(finding?.affectedCount).toBe(1);
  });

  it("does not penalize archived products for thin content", () => {
    const report = scoreSnapshot(
      snapshot([healthyProduct({ status: "ARCHIVED", descriptionLength: 0 })]),
    );
    expect(report.findings.find((f) => f.id === "content-thin-description")).toBeUndefined();
  });

  it("sorts findings by descending priority", () => {
    const report = scoreSnapshot(
      snapshot([
        healthyProduct({
          hasSeoTitle: false,
          hasSeoDescription: false,
          imageCount: 0,
          descriptionLength: 10,
        }),
      ]),
    );
    const priorities = report.findings.map((f) => f.priority);
    const sorted = [...priorities].sort((a, b) => b - a);
    expect(priorities).toEqual(sorted);
  });

  it("only reports domain scores for domains it can assess", () => {
    const report = scoreSnapshot(snapshot([healthyProduct()]));
    const domains = report.assessedDomains;
    // Product-level quick scan cannot assess CRO/performance from a catalog read.
    expect(domains).toContain("seo");
    expect(domains).toContain("inventory");
    expect(domains).not.toContain("cro");
    expect(domains).not.toContain("performance");
    for (const ds of report.domainScores) {
      expect(domains).toContain(ds.domain);
    }
  });

  it("propagates capture time and totals for honest 'as of' framing", () => {
    const report = scoreSnapshot({
      shopDomain: "example.myshopify.com",
      totalProducts: 500,
      products: [healthyProduct()],
      capturedAt: CAPTURED_AT,
    });
    expect(report.capturedAt).toBe(CAPTURED_AT);
    expect(report.totalProducts).toBe(500);
    expect(report.sampleSize).toBe(1);
  });
});
