# 33 — Performance

## Purpose
Define performance budgets and engineering practices for the embedded app, backend, AI, and storefront so the product is fast at 10k+ shops and passes Shopify performance expectations (`43`).

## Goals
- Snappy embedded UX within Shopify's iframe constraints.
- Backend + AI latency bounded and cost-aware.
- Storefront additions that don't harm Core Web Vitals.

## Budgets (targets; measured continuously `39`)
**Embedded app (in Admin):**
- Time-to-interactive (shell) p75 < 2.5s on typical merchant hardware/network.
- Route data (loader critical path) p95 < 500ms server time; defer the rest.
- Bundle: initial JS kept lean (route-split; heavy screens lazy); no unnecessary deps.
- Interaction latency (click→feedback) p95 < 100ms (optimistic UI where safe).

**Backend / API (`19`):**
- Read endpoints p95 < 300ms server (excluding intentional streams).
- Anything > ~few hundred ms or model/bulk → job (`17`), not request path.
- Webhook ack < Shopify timeout (fast-ack + enqueue, `24`).

**AI (`15`,`16`):**
- Copilot time-to-first-token p75 < 2s; stream thereafter.
- Model-tier routing: cheap model for classification/simple; frontier for reasoning.
- Per-turn/session/day token budgets enforced.

**Storefront (Theme App Extension `23`):**
- No regression to LCP/CLS/INP; block JS minimal, async/deferred; fail-open.

## Frontend performance (`21`)
- SSR + streaming/deferred data so the shell paints before slow data.
- Route-based code splitting; lazy-load charts/chat; tree-shake; avoid heavy client libs.
- Skeletons (no layout shift); virtualize long lists (findings, audit); debounce filters; paginate.
- Cache loader data; revalidate on focus; optimistic UI for reversible actions.
- Image/asset optimization; CDN (Cloudflare) for static assets.

## Backend performance (`20`)
- Thin request path; heavy work in workers (`17`).
- DB: proper indexes (`18`), cursor pagination, no N+1, connection pooling; precompute aggregates for dashboards/reports (`14`,`30`).
- Redis caching for hot reads (shop settings, aggregates, memory) with invalidation on webhooks (`24`).
- Batch + bulk for Shopify (`22`); never loop single calls.

## AI performance & cost (`16`,`31`)
- Parallelize retrieval; cache embeddings + retrieval + repeated system context; prompt-caching where provider supports.
- Model tiering + budgets; batch agent tasks; stream outputs.
- Bound context assembly (top-K memory, summaries) to control latency + tokens.

## Shopify API performance (`22`)
- Respect GraphQL cost + throttle; backoff; Bulk Operations for scale; cache stable reads; webhook-driven invalidation.

## Scalability practices
- Stateless web + horizontally scaled workers (autoscale on queue depth/latency).
- Per-shop rate limits + fairness (no noisy neighbor, `17`).
- Time-partitioned high-volume tables + retention (`18`,`42`).
- Load-tested against seeded 10k-shop / large-catalog datasets.

## Measurement (`39`)
- Real-user monitoring (Web Vitals in embedded app), server latency histograms, queue metrics, model latency/cost, DB slow-query logs. Dashboards + alerts on budget breaches. Performance is a tracked SLO, not a vibe.

## Edge cases
- Large catalog (100k SKUs) → aggregates + bulk ops + queued scans; dashboard never queries full catalog live.
- Slow merchant network / low-end device → skeletons, minimal JS, progressive reveal.
- Provider/Shopify latency spikes → timeouts + degrade + queue.
- Cold start (serverless/containers) → warm pools / min instances for the web tier.
- Cache stampede → request coalescing + jittered TTLs.

## Testing (`36`)
- Performance budgets enforced in CI (bundle size, Lighthouse/CWV for storefront), load tests (web + queue), DB query performance tests on large seed data, AI latency/cost benchmarks, and regression alerts.

## Future expansion
Edge rendering/caching (Cloudflare), read replicas, warehouse for analytics, precomputed personalization, and adaptive model routing by latency SLO (`50`).

## Decisions (ADR)
- **ADR-033-1:** Hard rule — model/bulk/heavy work never in the request path.
- **ADR-033-2:** Dashboards/reports read precomputed aggregates, never live full-catalog queries.
- **ADR-033-3:** Performance budgets are CI-enforced SLOs with alerting.

## Maintenance
Owned by Eng. Every feature declares its perf budget + loading strategy. Budgets reviewed each release; regressions block merge. Re-baseline as scale grows.
