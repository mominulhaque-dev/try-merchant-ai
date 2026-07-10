# 17 — Automation Engine

## Purpose
Specify the background execution + workflow system: how scans, agent tasks, automations, and scheduled work run reliably, safely, and at scale using Redis + BullMQ. This is the backbone that keeps the app responsive while agents do heavy, async work.

## Goals
- All non-trivial work runs as durable, observable, idempotent jobs — never in the request path.
- Merchant-defined automations (triggers → agent tasks) with guardrails + kill-switches.
- Scale to 10k+ shops without noisy-neighbor or runaway cost.

## Why a queue (not inline)
Shopify embedded requests must return fast (`33`); AI + bulk Shopify ops are slow and rate-limited. So every scan, agent task, bulk action, webhook-triggered job, and scheduled sweep is enqueued and processed by workers. Current template has none of this — it's the first infra we add on top of the React Router app.

## Stack
- **Redis 7** (managed) — queue backend + cache + locks.
- **BullMQ** — queues, workers, repeatable (cron) jobs, rate limiting, retries/backoff, flows (parent/child).
- **Workers** — separate Node processes (own Docker service, `37`,`38`) scaled horizontally, isolated from the web tier.
- **Prisma/Postgres** — durable job metadata, audit, results (`18`).

## Queue topology
| Queue | Purpose | Concurrency | Priority |
|---|---|---|---|
| `scan` | Store Health scans (parent) + per-dimension children | medium | normal |
| `agent-task` | Individual agent reasoning/action tasks | tuned per model rate | normal |
| `action-execute` | Store mutations (Admin GraphQL writes) | low, per-shop capped | high |
| `webhook` | Webhook-triggered processing (`24`) | high | high |
| `automation` | Scheduled/triggered merchant automations | medium | normal |
| `email/notify` | Digests + notifications (`28`) | medium | low |
| `billing/meter` | Usage aggregation (`27`) | low | low |
| `maintenance` | Backups, cleanup, retention (`42`) | low | low |

- **Per-shop fairness:** rate-limit + concurrency caps keyed by shop to prevent one large store starving others (noisy-neighbor control). BullMQ groups/rate-limiter per shop key.
- **Flows:** a scan is a parent job fanning out per-dimension child jobs, aggregated on completion (BullMQ flows).

## Job contract
```ts
interface Job<T> {
  id: string;                 // stable, idempotency-aware
  shop: string;               // tenant key (isolation)
  type: JobType;
  payload: T;                 // validated schema
  attempts: number;           // retries with exp backoff
  idempotencyKey: string;     // dedupe
  budget?: { aac?: number };  // cost cap
  traceId: string;            // observability (39)
}
```
- **Idempotency:** every job is safe to retry; writes use idempotency keys + optimistic concurrency so a retry never double-applies a mutation.
- **Validation:** payloads schema-validated on enqueue and dequeue.

## Triggers (what starts work)
1. **Manual** — merchant clicks (run scan, fix it) → enqueue.
2. **Scheduled** — repeatable jobs (nightly health sweep, weekly report) via BullMQ cron.
3. **Webhooks** — Shopify events (product update, order create, app/uninstalled) → `webhook` queue → maybe spawn agent tasks (`24`).
4. **Events** — internal (a finding created → offer automation; an action executed → verify outcome).
5. **Automations** — merchant-configured trigger + agent task + autonomy + guardrails (`07` F-04).

## Automations (merchant-facing workflows)
- **Definition:** `trigger (schedule|webhook|event) + agentTask + trustLevel + guardrails (caps, allowlist, quiet hours) + killSwitch`.
- **Autonomy:** governed by trust ladder (`16`,`00` P2). Anything above Approve requires explicit consent + shows what runs unattended.
- **Guardrails:** max actions/run + /day, resource allowlist, anomaly-revert (if a metric worsens, auto-pause + revert reversible changes), global + per-automation kill-switch.
- **Run history:** every run is an audited job with before/after + outcome (`41`,`30`).

## Reliability
- **Retries:** exponential backoff with jitter; max attempts per job type; poison jobs → **dead-letter queue** + alert (`39`,`40`).
- **Locks:** Redis-based single-writer lock per resource (`16`) to prevent concurrent clobbering.
- **Idempotent writes:** optimistic concurrency + idempotency keys.
- **Graceful shutdown:** workers finish/return in-flight jobs on deploy (`38`); no lost work.
- **At-least-once delivery** + idempotency = effectively-once effects.

## Scalability
- Horizontal worker scaling per queue; autoscale on queue depth/latency.
- Per-shop rate limiting + Shopify API cost-aware throttling (`22`).
- Bulk operations for large catalogs (Shopify Bulk Operations API) instead of N calls.
- Backpressure: shed/delay low-priority work under load; protect `action-execute` + `webhook`.

## Cost control (`00` P7)
- Per-job + per-shop AAC budgets; model-tier routing (`16`); batching; caching. A job that would exceed budget pauses + notifies rather than overrunning.

## Observability (`39`,`41`)
- Every job: structured logs with `traceId`, metrics (duration, attempts, outcome), and queue metrics (depth, wait, failure rate). Dashboards + alerts on queue backlog, DLQ growth, failure spikes. Job status visible to merchant where relevant (scan progress, automation runs).

## Security (`32`)
- Jobs are shop-scoped; workers enforce tenant isolation on every query/tool. Payloads validated. Secrets from env/secret store, never in payloads. Audit for all mutations.

## Edge cases
- **Webhook storm** (bulk edit) → debounce/coalesce per shop + resource; dedupe by idempotency key.
- **Scope revoked mid-job** → policy layer aborts, rolls back partials, notifies (`26`).
- **Uninstall mid-run** → cancel shop's jobs, invalidate tokens, start retention timer (`09`,`42`).
- **Runaway automation loop** → circuit breaker + per-shop cap + alert.
- **Redis outage** → web tier degrades to enqueue-on-recovery / Suggest-only; no data loss (durable metadata in Postgres); alert.
- **Long scan** → parent/child flow + progress + notify on completion; merchant keeps working.
- **Duplicate delivery** → idempotency dedupe.

## Testing (`36`)
Unit (job handlers, guardrails), integration (queue + Redis + DB), idempotency/retry tests (double-delivery, mid-failure), load tests (queue depth, per-shop fairness), chaos (kill worker mid-job → resumes), and automation e2e (trigger→run→audit→revert).

## Future expansion
Visual workflow builder (drag triggers/agents), cross-agent flows, event-sourced automation history, priority tiers by plan, and third-party agent jobs via marketplace runtime (`50`).

## Decisions (ADR)
- **ADR-017-1:** BullMQ + Redis for all async work; nothing heavy in the request path.
- **ADR-017-2:** Effectively-once via at-least-once delivery + idempotent, optimistic-concurrency writes.
- **ADR-017-3:** Anomaly-revert + kill-switch mandatory for any above-Approve automation.

## Maintenance
Owned by Backend. New job types register a queue policy (concurrency, retries, budget) + telemetry + tests. Redis/BullMQ upgrades verified against idempotency + fairness suites.
