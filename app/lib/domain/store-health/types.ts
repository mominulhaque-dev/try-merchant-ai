import type { FindingDomain, Severity } from "../enums";

/**
 * Store Health quick-scan contracts (docs/07 F-01, docs/14).
 *
 * A {@link StoreSnapshot} is a bounded, read-only sample of the store captured
 * server-side from the Admin API. Pure scoring in `score.ts` turns it into a
 * {@link HealthReport}. Keeping the snapshot and the scoring separate makes the
 * scoring deterministic and unit-testable with no network, and lets the same
 * scorer run later over a persisted/cached scan (M0.T7 + M1.T5) without change.
 */

/** One product, reduced to the fields the health checks actually read. */
export interface ProductSnapshot {
  readonly id: string;
  readonly title: string;
  readonly handle: string;
  /** Shopify product status, normalized to uppercase (ACTIVE/DRAFT/ARCHIVED). */
  readonly status: string;
  /** Plain-text description length in characters (0 when empty). */
  readonly descriptionLength: number;
  readonly hasSeoTitle: boolean;
  readonly hasSeoDescription: boolean;
  readonly imageCount: number;
  /** Images (within the sampled media) that have no alt text. */
  readonly imagesMissingAlt: number;
  /** Total inventory across variants; null when inventory isn't tracked. */
  readonly totalInventory: number | null;
  readonly variantCount: number;
}

/** A bounded sample of the store used for a quick scan (docs/14 edge: huge catalog). */
export interface StoreSnapshot {
  readonly shopDomain: string;
  /** Total products in the store (from a count query), for context vs the sample. */
  readonly totalProducts: number;
  /** The sampled products the checks ran over (bounded; see snapshot.server.ts). */
  readonly products: readonly ProductSnapshot[];
  /** ISO-8601 capture time, threaded in by the caller (no clock in pure code). */
  readonly capturedAt: string;
}

/**
 * A single explainable issue mapped to a typed, reversible action (docs/07 F-02).
 * `actionType` references the tool catalog so the Fix-it pipeline (M1.T7) can act
 * on it directly. `priority` = impact × confidence ÷ effort (docs/14).
 */
export interface HealthFinding {
  readonly id: string;
  readonly domain: FindingDomain;
  readonly severity: Severity;
  readonly title: string;
  readonly rationale: string;
  /** Recommended typed action (tool-catalog name), or null for advisory-only. */
  readonly actionType: string | null;
  /** Relative fix effort 1 (trivial) … 5 (project). */
  readonly effort: number;
  /** How many sampled items are affected. */
  readonly affectedCount: number;
  /** The sample size the affected count is out of (for honest framing). */
  readonly sampleSize: number;
  /** Sort key: higher = fix sooner. */
  readonly priority: number;
}

export interface DomainScore {
  readonly domain: FindingDomain;
  /** 0–100; higher is healthier. */
  readonly score: number;
  readonly findingCount: number;
}

export interface HealthReport {
  /** Weighted composite of assessed domain scores, 0–100 (docs/14). */
  readonly overallScore: number;
  readonly domainScores: readonly DomainScore[];
  readonly findings: readonly HealthFinding[];
  /** Which domains this quick scan could actually assess from a product read. */
  readonly assessedDomains: readonly FindingDomain[];
  readonly totalProducts: number;
  readonly sampleSize: number;
  readonly capturedAt: string;
}
