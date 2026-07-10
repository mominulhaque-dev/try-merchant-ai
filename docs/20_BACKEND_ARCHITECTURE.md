# 20 — Backend Architecture

## Purpose
Define backend structure: services, boundaries, data flow, and how the request-path app, workers, AI runtime, and Shopify integration fit together — grounded in the actual React Router 7 + Node app.

## Goals
- Clear module boundaries (domain-driven) inside one codebase (modular monolith), splittable later.
- Separation of web tier (fast) and worker tier (heavy) sharing typed domain logic.
- Testable, observable, tenant-isolated services.

## Topology (modular monolith → services later)
```
┌───────────────────────────────────────────────┐
│ Web tier (React Router 7 server)               │
│  routes/ (loaders, actions, api.*, webhooks.*) │
│  → thin: auth + validate + read/enqueue        │
└───────────┬───────────────────────────────────┘
            │ shared domain modules (app/lib/*)   │
┌───────────▼───────────────────────────────────┐
│ Domain services (pure-ish, framework-agnostic) │
│  shop, scan, findings, actions, automation,    │
│  agents/runtime, memory, billing, analytics    │
└───┬───────────────┬──────────────┬─────────────┘
    │               │              │
┌───▼────┐   ┌──────▼─────┐  ┌─────▼───────┐
│ Prisma │   │ Redis/Bull │  │ Shopify GQL │
│ (PG)   │   │ (17)       │  │ client (22) │
└────────┘   └──────┬─────┘  └─────────────┘
                    │
        ┌───────────▼───────────┐
        │ Worker tier (BullMQ)  │  same domain modules,
        │ scan/agent/action/... │  runs heavy async work
        └───────────────────────┘
     AI provider abstraction (Anthropic/OpenAI/MCP) used by runtime
```
Both web + worker import the same `app/lib` domain modules — logic written once, invoked from a loader/action or a job.

## Module layout (proposed)
```
app/
  routes/              # RR7 routes (web tier only)
  lib/
    shopify/           # admin client, graphql docs, bulk ops (22)
    db/                # prisma client, repositories
    domain/
      shop/ scan/ findings/ actions/ automation/
      billing/ analytics/ memory/ notifications/
    agents/
      runtime/         # AgentSpec engine, policy layer, action pipeline (16)
      tools/           # typed tool catalog (19)
      orchestrator/
      specs/           # per-agent AgentSpec definitions
    ai/                # provider abstraction, MCP, prompts, budgets
    queue/             # BullMQ queues, workers, schedulers (17)
    security/          # authz, tenant guards, injection defenses (32)
    telemetry/         # logging, metrics, tracing (39,41)
  components/          # FE (13,21)
workers/               # worker process entrypoints (or app/lib/queue/workers)
prisma/                # schema + migrations (18)
extensions/            # Shopify extensions (theme app ext, admin ext) (23)
```

## Service boundaries (responsibilities)
- **shop:** install/uninstall lifecycle, settings, plan tier.
- **scan:** orchestrate health scans (parent/child jobs), aggregate findings.
- **findings:** CRUD, prioritization, dismiss/snooze, map to actions.
- **actions:** the pipeline (validate→preview→approve→execute→verify→audit→undo).
- **automation:** definitions, triggers, runs, guardrails, kill-switch.
- **agents/runtime:** AgentSpec engine, policy layer, orchestrator, tools.
- **memory:** structured + vector memory (`31`).
- **billing:** entitlements, Shopify Billing, metering (`27`).
- **analytics:** event ingest, metrics, MAVD (`29`,`30`).
- **notifications:** in-app/email/digest (`28`).
- **security/telemetry:** cross-cutting (`32`,`39`,`41`).
Boundaries are enforced by module APIs; cross-module access goes through a module's public interface, not its internals.

## Request-path vs. worker rules (`17`)
- **In the request path:** auth, validation, quick DB reads/writes, enqueuing, streaming setup. Hard latency budget (`33`).
- **In workers:** AI calls, bulk Shopify ops, scans, automations, emails, metering rollups, backups.
- Rule: if it can exceed ~a few hundred ms or calls a model/bulk API, it's a job.

## Data flow example (Fix an SEO title)
1. UI action → `action` in `app.findings.$id.tsx` → authenticate + validate.
2. `actions` service creates `ActionRecord` (PENDING), computes dry-run preview (read via Shopify client) → returns diff.
3. Merchant approves → enqueue `action-execute` job.
4. Worker: policy layer checks (scope/plan/trust/lock/budget) → execute Admin GraphQL mutation → verify → write `AuditLog` + `ActionRecord(done)` in a transaction → register undo token → emit event + notification.
5. UI polls/streams status → shows done + undo.

## Concurrency & consistency
- Single-writer locks per resource (Redis) (`16`).
- Optimistic concurrency + idempotency keys on writes (`17`,`18`).
- Transactions for action+audit atomicity.
- Effectively-once effects via at-least-once delivery + idempotent handlers.

## Configuration & secrets (`32`,`37`)
- All config via env (12-factor); secrets from a secret manager, never in code/DB/logs. `SHOPIFY_API_SECRET`, provider keys, `DATABASE_URL`, `REDIS_URL` injected at runtime.
- Feature flags for gradual rollout (`38`,`49`).

## Scalability
- Web + workers scale horizontally + independently (stateless web, queue-driven workers).
- Postgres with pooling + read replicas later; Redis clustered if needed.
- Per-shop fairness + rate limiting (`17`); bulk ops for large stores (`22`).
- Modular monolith now; extract worker/AI services when a boundary demands it — boundaries already drawn so extraction is mechanical.

## Reliability (`40`,`42`)
- Graceful shutdown drains in-flight jobs; health checks + readiness probes; circuit breakers around providers; DLQ + alerting; backups + tested restores.

## Security (`32`)
- Tenant isolation guard in every domain service; input validation; authz at boundaries; injection defenses on AI surfaces; least-privilege scopes; audited mutations.

## Observability (`39`,`41`)
- Structured logs w/ `traceId`, metrics per service + queue, tracing across web→job→tool→Shopify, SLOs + alerts.

## Edge cases
- Provider/Redis/Shopify outages → degrade gracefully, never lose durable state.
- Hot shop (huge store) → per-shop caps + bulk ops prevent starving others.
- Deploy during long jobs → drain + resume (`38`).
- Migration under load → expand/contract (`18`).

## Testing (`36`)
Unit (domain modules, pure logic), integration (services + PG + Redis + Shopify mock), contract (API `19`), e2e (critical flows), load + chaos. Domain logic tested independent of RR7.

## Future expansion
Extract AI runtime + workers into standalone services; event-sourced action history; multi-region sharding by shop; public API service (`50`).

## Decisions (ADR)
- **ADR-020-1:** Modular monolith with strict domain boundaries; web + workers share `app/lib` domain code.
- **ADR-020-2:** Anything model-calling or bulk = a job, never in the request path.
- **ADR-020-3:** `shop` tenant guard mandatory at every domain-service entry.

## Maintenance
Owned by Backend. New domain logic goes in `app/lib/domain/*` (not in routes). Cross-module calls via public interfaces. Keep module layout synced with reality.
