import type { FindingDomain, Severity } from "../enums";
import type {
  DomainScore,
  HealthFinding,
  HealthReport,
  ProductSnapshot,
  StoreSnapshot,
} from "./types";

/**
 * Pure Store Health scoring (docs/07 F-01, docs/14). Deterministic and
 * dependency-free: the same {@link StoreSnapshot} always yields the same
 * {@link HealthReport}, so it is fully unit-testable without network or DB, and
 * runs unchanged later over a persisted scan (M1.T5). No clock, no randomness.
 *
 * Method: each check counts affected items in the sample, derives a 0–100 domain
 * score from the affected ratio, and emits a finding when the issue is material.
 * The overall score is the weighted mean of the domains this scan could assess
 * (docs/14 — never present an unassessed domain as a perfect 100).
 */

/** Relative weight of each domain in the composite (docs/14 weighted composite). */
const DOMAIN_WEIGHT: Record<FindingDomain, number> = {
  seo: 1.2,
  content: 1,
  catalog: 1,
  cro: 0.9,
  performance: 0.8,
  inventory: 1,
};

/** A domain is "healthy by default" until a check lowers it; clamps to [0,100]. */
function ratioToScore(affected: number, sample: number): number {
  if (sample <= 0) return 100;
  const healthy = 1 - affected / sample;
  return Math.round(Math.max(0, Math.min(1, healthy)) * 100);
}

function severityForRatio(ratio: number): Severity {
  if (ratio >= 0.75) return "CRITICAL";
  if (ratio >= 0.5) return "HIGH";
  if (ratio >= 0.25) return "MEDIUM";
  if (ratio > 0) return "LOW";
  return "INFO";
}

/** Impact × confidence ÷ effort, on a 0–100-ish scale for stable sorting. */
function priority(affectedRatio: number, severity: Severity, effort: number): number {
  const severityWeight: Record<Severity, number> = {
    INFO: 0.2,
    LOW: 0.4,
    MEDIUM: 0.6,
    HIGH: 0.8,
    CRITICAL: 1,
  };
  const impact = affectedRatio * severityWeight[severity];
  // Confidence is high: these are counted facts over the sample, not estimates.
  const confidence = 0.95;
  return Math.round((impact * confidence * 100) / Math.max(1, effort));
}

interface CheckResult {
  readonly domain: FindingDomain;
  readonly finding: HealthFinding | null;
}

/** Definition of one health check over the sampled products. */
interface Check {
  readonly id: string;
  readonly domain: FindingDomain;
  readonly title: string;
  readonly actionType: string | null;
  readonly effort: number;
  /** True when a product is affected (counts toward the domain penalty). */
  readonly affected: (p: ProductSnapshot) => boolean;
  /** Builds the human rationale once the affected count is known. */
  readonly rationale: (affected: number, sample: number) => string;
}

const CHECKS: readonly Check[] = [
  {
    id: "seo-missing-title",
    domain: "seo",
    title: "Products missing an SEO title",
    actionType: "product.updateSeo",
    effort: 1,
    affected: (p) => !p.hasSeoTitle,
    rationale: (a, s) =>
      `${a} of ${s} sampled products have no custom SEO title, so search engines fall back to the product name and lose ranking signal.`,
  },
  {
    id: "seo-missing-meta",
    domain: "seo",
    title: "Products missing a meta description",
    actionType: "product.updateSeo",
    effort: 1,
    affected: (p) => !p.hasSeoDescription,
    rationale: (a, s) =>
      `${a} of ${s} sampled products have no meta description, reducing click-through from search results.`,
  },
  {
    id: "content-thin-description",
    domain: "content",
    title: "Products with thin or missing descriptions",
    actionType: "product.updateContent",
    effort: 2,
    affected: (p) => p.descriptionLength < 200 && p.status !== "ARCHIVED",
    rationale: (a, s) =>
      `${a} of ${s} sampled products have descriptions under 200 characters. Thin content converts worse and ranks lower.`,
  },
  {
    id: "seo-missing-alt",
    domain: "seo",
    title: "Product images missing alt text",
    actionType: "image.setAlt",
    effort: 1,
    affected: (p) => p.imagesMissingAlt > 0,
    rationale: (a, s) =>
      `${a} of ${s} sampled products have images without alt text, hurting accessibility and image SEO.`,
  },
  {
    id: "catalog-no-image",
    domain: "catalog",
    title: "Products with no images",
    actionType: null,
    effort: 2,
    affected: (p) => p.imageCount === 0 && p.status !== "ARCHIVED",
    rationale: (a, s) =>
      `${a} of ${s} sampled products have no image. Shoppers rarely buy what they can't see.`,
  },
  {
    id: "inventory-out-of-stock",
    domain: "inventory",
    title: "Active products that are out of stock",
    actionType: null,
    effort: 2,
    affected: (p) =>
      p.status === "ACTIVE" && p.totalInventory !== null && p.totalInventory <= 0,
    rationale: (a, s) =>
      `${a} of ${s} sampled products are active but out of stock, so ad spend and traffic land on unbuyable pages.`,
  },
];

/** Run one check over the sample and, if material, produce a finding. */
function runCheck(check: Check, products: readonly ProductSnapshot[]): CheckResult {
  const sample = products.length;
  const affectedCount = products.reduce((n, p) => n + (check.affected(p) ? 1 : 0), 0);
  if (affectedCount === 0) return { domain: check.domain, finding: null };

  const ratio = sample > 0 ? affectedCount / sample : 0;
  const severity = severityForRatio(ratio);
  return {
    domain: check.domain,
    finding: {
      id: check.id,
      domain: check.domain,
      severity,
      title: check.title,
      rationale: check.rationale(affectedCount, sample),
      actionType: check.actionType,
      effort: check.effort,
      affectedCount,
      sampleSize: sample,
      priority: priority(ratio, severity, check.effort),
    },
  };
}

/**
 * Score a store snapshot into an explainable health report (docs/14).
 * Findings are sorted highest-priority first; domain scores cover only the
 * domains this product-level scan can actually assess.
 */
export function scoreSnapshot(snapshot: StoreSnapshot): HealthReport {
  const { products } = snapshot;
  const results = CHECKS.map((check) => runCheck(check, products));

  const findings = results
    .map((r) => r.finding)
    .filter((f): f is HealthFinding => f !== null)
    .sort((a, b) => b.priority - a.priority || b.severity.localeCompare(a.severity));

  // Assessed domains = the distinct domains our checks cover (deterministic).
  const assessedDomains = [...new Set(CHECKS.map((c) => c.domain))];

  const domainScores: DomainScore[] = assessedDomains.map((domain) => {
    const domainChecks = results.filter((r) => r.domain === domain);
    // A domain's score is the mean of its checks' individual affected-ratio scores.
    const perCheck = domainChecks.map((r) =>
      ratioToScore(r.finding ? r.finding.affectedCount : 0, products.length),
    );
    const score =
      perCheck.length > 0
        ? Math.round(perCheck.reduce((s, v) => s + v, 0) / perCheck.length)
        : 100;
    return {
      domain,
      score,
      findingCount: domainChecks.filter((r) => r.finding !== null).length,
    };
  });

  const overallScore = weightedOverall(domainScores);

  return {
    overallScore,
    domainScores,
    findings,
    assessedDomains,
    totalProducts: snapshot.totalProducts,
    sampleSize: products.length,
    capturedAt: snapshot.capturedAt,
  };
}

function weightedOverall(domainScores: readonly DomainScore[]): number {
  if (domainScores.length === 0) return 100;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const ds of domainScores) {
    const w = DOMAIN_WEIGHT[ds.domain];
    weightedSum += ds.score * w;
    weightTotal += w;
  }
  return Math.round(weightedSum / weightTotal);
}
