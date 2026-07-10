# 29 — Analytics Engine

## Purpose
Define how we capture, process, and use data: product analytics (usage/funnels), store analytics (merchant's commerce data), and outcome attribution (MAVD) — the proof-of-ROI engine that is our moat (`01`,`00` P10).

## Goals
- One reliable event pipeline for product + outcome analytics.
- Trustworthy MAVD attribution tying actions to metric changes.
- Privacy-respecting, tenant-isolated, scalable to 10k+ shops.

## Three analytics domains
1. **Product analytics** — how merchants use TryMerchantAI (activation, funnels, feature usage, retention). Drives PM decisions (`06`).
2. **Store analytics** — the merchant's own commerce metrics (traffic, conversion, AOV, revenue, inventory), sourced from Shopify + storefront events. Feeds agents + dashboard (`14`).
3. **Outcome attribution (MAVD)** — did an approved action improve the target metric? The retention + pricing engine (`27`,`30`).

## Event pipeline
```
Sources:
  - App UI events (client → server, no PII in client)
  - Server domain events (action executed, scan done, agent task)
  - Shopify data (Admin GraphQL: orders, products, inventory) (22)
  - Storefront events (Theme App Extension, consented) (23,44)
        │
        ▼
  Ingest endpoint / emitter → validate + enrich (shop, traceId, ts)
        │
        ▼
  Event store (append-only `Event` table, 18) + queue for heavy rollups (17)
        │
        ▼
  Aggregation jobs → metrics tables / cache (dashboard, reports)
        │
        ▼
  Warehouse (optional, later) for deep analysis + benchmark products
```
- **Event schema:** `{ shop, name, props, userId?, traceId, ts }`. Names namespaced (`app.dashboard.view`, `action.executed`, `scan.completed`). Versioned schema; validated on ingest.
- **Delivery:** client events batched + sent server-side (never expose keys client-side); server events emitted inline; heavy aggregation in jobs.

## Key product metrics (`01`,`06`)
- **Activation funnel:** install → scan started → first finding → first action approved (target activation ≥40%).
- **Engagement:** WAS (weekly active store), DAU/WAU, sessions, feature adoption, agent adoption, autonomy level distribution.
- **Retention:** cohort retention (D1/D7/D30, weekly), churn + reasons.
- **Monetization:** trial→paid, upgrade/expansion, NRR, AAC usage.
- **Guardrails:** action error rate, undo rate, refusal rate, complaint/uninstall reasons.

## MAVD attribution (the moat)
- For each executed action, capture **before/after** of the target metric over a defined window, with a **baseline/control** where possible (e.g., experiment container `23`, holdout, or pre/post with seasonality adjustment).
- Attribution methods by action type: A/B where feasible (CRO/recommendations), pre/post with confidence intervals (SEO/content — noisier), direct (hours saved = action count × labor rate; inventory saved = units × margin).
- **Confidence labeling:** every MAVD figure carries a confidence level; never present a noisy estimate as certainty (`11`,`30`). Aggregate to period MAVD for dashboard/reports.
- Feeds the **prioritization flywheel:** measured outcomes refine impact estimates for future findings (`16`).

## Store analytics
- Sourced from Shopify (orders/products/inventory via GraphQL + webhooks, `22`,`24`) + storefront events (`23`). Cached aggregates (not full mirrors) with "as of" freshness. Powers dashboard KPIs + agent baselines (memory `31`).

## Privacy & compliance (`32`,`44`)
- **Consent-aware storefront tracking:** respect the shopper's consent (Shopify Customer Privacy API / consent banner); no tracking without consent; no PII in analytics events where avoidable; pseudonymous visitor ids.
- **Tenant isolation:** every event/metric shop-scoped; no cross-tenant queries.
- **Aggregated benchmarks** (future data product) use anonymized, consented, aggregated data only — never expose one merchant's data to another (`02`).
- **Data minimization + retention:** raw events aged out; aggregates retained; redaction on `customers/redact`/`shop/redact` (`24`).

## Scalability & performance (`33`)
- Append-only ingest (cheap writes); async aggregation (jobs); time-partitioned event table + retention (`18`,`42`); cached metrics for dashboards; batch client events; consider a warehouse (BigQuery/ClickHouse) when volume demands.
- No heavy analytics query in the request path — precompute + cache.

## Observability of the pipeline (`39`)
- Monitor ingest rate, validation failures, aggregation lag, metric freshness. Alert on pipeline stalls (stale dashboards) or event drops.

## Edge cases
- Sparse data (new/small store) → show ranges/low-confidence, not fake precision.
- Attribution ambiguity (many changes at once) → lower confidence + explain; prefer controlled tests.
- Seasonality/external shocks → baseline adjustment; flag anomalies (Analytics Agent).
- Consent withheld → no storefront tracking; store analytics from Shopify only.
- Event schema change → versioned, backward-compatible ingest.
- Bot/spam traffic → filtered from conversion metrics.
- Duplicate events → dedupe by event id.

## Testing (`36`)
- Ingest validation tests, aggregation correctness (golden datasets), attribution logic tests (pre/post + experiment), consent-gating tests, tenant-isolation tests, retention/redaction tests, and pipeline load tests.

## Future expansion
Warehouse + BI, benchmark data products, predictive analytics (forecast demand/churn), self-serve exploration, and cohort ROI case studies for sales (`50`,`30`).

## Decisions (ADR)
- **ADR-029-1:** MAVD is the north-star instrument; every executed action captures before/after + confidence.
- **ADR-029-2:** Storefront tracking is consent-gated + pseudonymous; benchmarks only from anonymized aggregates.
- **ADR-029-3:** No analytics in the request path — append-only ingest + async rollups.

## Maintenance
Owned by Data/PM. New events registered in a schema registry; new metrics documented + tested. Monitor freshness + attribution quality; re-verify consent handling each Shopify privacy update.
