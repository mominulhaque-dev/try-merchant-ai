# 39 — Monitoring & Observability

## Purpose
Define observability: metrics, tracing, logging integration, SLOs, dashboards, and alerting — so we detect + diagnose issues before merchants do, and can prove reliability.

## Goals
- Full visibility across web, workers, AI, queues, DB, and Shopify integration.
- SLOs with alerting; fast MTTR.
- AI-specific + cost observability (unique to this product).

## Three pillars (+ AI)
1. **Metrics** — RED (Rate, Errors, Duration) + USE (Utilization, Saturation, Errors) + business + AI metrics.
2. **Tracing** — distributed traces (`traceId`) across request → job → tool → Shopify/provider (`19`,`41`).
3. **Logs** — structured, correlated (`41`).
4. **AI/cost telemetry** — tokens, cost, latency, quality, safety per agent.

## Stack (proposed)
- Metrics + dashboards: Prometheus/Grafana or a managed APM (Datadog/Grafana Cloud).
- Tracing: OpenTelemetry → APM.
- Logs: structured JSON → aggregator (Loki/Datadog/ELK) (`41`).
- Errors: Sentry (or APM error tracking) (`40`).
- Uptime/synthetics: external monitors on key endpoints + flows.
- Provisioned via IaC (`37`).

## Key metrics

**Application/API (`19`,`33`):**
- Request rate, error rate (by code), latency p50/p95/p99 per route/endpoint.
- Web Vitals (RUM) for embedded app (LCP/INP/CLS).

**Workers/queues (`17`):**
- Queue depth, wait time, processing time, failure rate, retry rate, DLQ size per queue.
- Per-shop fairness metrics; job throughput.

**Database (`18`):**
- Connections, slow queries, replication lag, storage, lock contention.

**Redis:** memory, hit rate, evictions, latency.

**Shopify integration (`22`):**
- GraphQL cost/throttle rate, bulk-op status, API error rate, webhook receipt/verification-failure/processing latency.

**AI (`15`,`16`):**
- Tokens + cost per agent/shop/day, model latency + TTFT, tool-call rate, action success/revert rate, refusal rate, provider error/failover rate, budget-exceeded rate, safety-block rate.

**Business (`29`):**
- Activation, WAS, MAVD, conversion, churn signals (for ops awareness + anomaly detection).

## SLOs (targets; refined with data)
| Service | SLI | SLO |
|---|---|---|
| Embedded app | availability | 99.9% |
| Core API reads | p95 latency | < 300ms |
| Webhook processing | ack success | > 99.9%, ack < timeout |
| Copilot | TTFT p75 | < 2s |
| Job success | non-DLQ completion | > 99% |
| Action execution | success (excl. user-cancel) | > 99% |
- **Error budgets** per SLO; burn-rate alerting; budget exhaustion pauses risky releases (`38`).

## Dashboards
- **Overview:** availability, error rate, latency, queue health, cost/day.
- **AI ops:** per-agent cost/latency/quality/safety; provider health.
- **Shopify:** throttle, webhook health, bulk ops.
- **Business:** activation funnel, WAS, MAVD, churn (`29`).
- **Per-shop drill-down:** for support/debugging a specific merchant (`47`).

## Alerting
- Tiered: **page** (SLO breach, prod down, DLQ growth, webhook verification-failure spike = possible attack, provider all-down, cost anomaly) vs. **ticket** (degradations, elevated retries).
- Actionable alerts only (no noise); each links to a runbook (`48`). On-call rotation + escalation.
- Anomaly detection on cost + error rates (catch runaway AI early, `16`).

## Tracing
- `traceId` per request propagated to jobs, tool calls, provider + Shopify calls (`19`,`41`). Sample intelligently (100% errors, sampled success). Enables root-cause across the async pipeline.

## AI-specific monitoring (critical)
- Every agent emits: cost, latency, tool calls, outcome (success/revert), safety-block events, refusals. Dashboards per agent; alerts on revert-rate spikes (a bad agent), cost anomalies, or safety-block spikes (attack/injection).
- Continuous eval scores (`36`) tracked over releases; regression alerts.

## Security monitoring (`32`)
- Auth failure rates, webhook HMAC failures, authz denials, anomalous access patterns, secret-access audit → SIEM/alerts. Feeds incident response (`40`,`48`).

## Cost monitoring (`00` P7,`27`)
- AI + infra cost per shop/plan/agent; margin dashboards; alerts on per-shop or aggregate cost anomalies; ties to AAC metering reconciliation (`27`).

## Edge cases
- Alert storms → dedup/grouping + inhibition rules.
- Monitoring outage → redundant external synthetics; monitor the monitors.
- Metric cardinality explosion (per-shop labels) → aggregate + sample; drill-down via traces/logs not high-cardinality metrics.
- Silent failures (job stuck) → heartbeat + freshness alerts (stale dashboards, stalled queues).

## Testing (`36`)
- Verify instrumentation in integration tests (events emitted), alert rules tested (fire on synthetic breach), dashboard queries validated, trace propagation tested end-to-end.

## Future expansion
SLO-based auto-rollback (`38`), predictive alerting, per-merchant health scores for CS, and public status page (`47`).

## Decisions (ADR)
- **ADR-039-1:** `traceId` propagates request→job→tool→external; observability is designed-in, not added later.
- **ADR-039-2:** AI cost + safety-block + revert-rate are first-class monitored signals with anomaly alerting.
- **ADR-039-3:** Every page-level alert links to a runbook (`48`).

## Maintenance
Owned by DevOps + Eng. New services/agents ship with metrics + dashboards + alerts + runbook. SLOs reviewed quarterly with real data; alert quality pruned continuously.
