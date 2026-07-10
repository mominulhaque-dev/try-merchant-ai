# 07 — Feature Specification

## Purpose
Feature-level specifications that turn PRD epics (`06`) into precise, buildable behavior: inputs, outputs, states, business logic, edge cases, and acceptance tests. Engineers implement from here.

## Convention
Each feature: **ID · Summary · Actors · Preconditions · Business logic · Technical logic · States (empty/loading/success/error) · Edge cases · Security · Data · API · Telemetry · Acceptance.**

---

## F-01 · Store Health Scan
- **Summary:** On-demand + scheduled audit producing a prioritized action list.
- **Actors:** Store Health Agent (`16`), merchant.
- **Preconditions:** Installed, offline token valid, scopes for read access.
- **Business logic:** Pull catalog/theme/inventory/traffic snapshots → run rule-based checks + LLM assessment per dimension (SEO, CRO, content, catalog, performance, inventory) → score findings by `impact × confidence × effort` → dedupe → persist as `Finding` records with a recommended, typed action.
- **Technical logic:** Enqueue `store.health.scan` job (BullMQ, `17`). Fan out per-dimension sub-jobs; each fetches via Admin GraphQL (bulk ops for large catalogs, `22`). Results aggregated, cached, versioned per scan run. Idempotent per shop+run.
- **States:** *empty* (never scanned → CTA "Run first scan"), *loading* (progress by dimension), *success* (grouped findings), *partial* (some dimensions failed → show what succeeded + retry), *error* (retry + support link).
- **Edge cases:** huge catalog → sample + queue; zero products → setup-focused findings; API rate limits → backoff + resume (`22`); stale cache → show "as of" timestamp.
- **Security:** read-only; no PII sent to models beyond necessity, de-identified (`32`).
- **Data:** `Finding`, `ScanRun` (`18`).
- **API:** internal `POST /api/scans`, `GET /api/scans/:id` (`19`); Shopify Admin GraphQL reads.
- **Telemetry:** scan started/completed/duration, findings count by severity, dimension failures.
- **Acceptance:** p50 first finding <60s; deterministic dedupe; every finding has a reversible/gated action; partial failures never block the whole scan.

## F-02 · Finding → Action ("Fix it")
- **Summary:** Convert a finding into a previewed, approved, executed, reversible action.
- **Business logic:** Each finding maps to a typed `Action` (e.g., `product.updateSeoTitle`, `image.addAltText`). Merchant clicks "Fix it" → preview (before/after diff) → approve → execute → verify → log → offer undo.
- **Technical logic:** Action pipeline (`16`/`17`): schema-validate params → dry-run (compute diff, no write) → require approval per trust ladder → execute via Admin GraphQL mutation → verify result → write `AuditLog` with before/after → register undo token.
- **States:** preview, approving, executing, done (with undo), failed (with reason + retry), partial (multi-item → per-item status).
- **Edge cases:** resource changed since preview (optimistic concurrency → re-preview); irreversible action (explicit confirm, no silent auto); bulk action (chunk + progress + partial rollback).
- **Security:** verify scope present; single-writer lock on resource (`16`); rate-limit.
- **Data:** `Action`, `AuditLog`, `UndoToken` (`18`).
- **Acceptance:** 100% mutations audited; undo restores prior state for all reversible types; concurrency-safe.

## F-03 · AI Copilot Chat
- **Summary:** Grounded, streaming chat that can read store data and (with approval) act.
- **Business logic:** Merchant asks → orchestrator routes to relevant agent(s) → agent reasons over live data + memory → responds with streamed answer + optional actionable cards. Actions follow F-02.
- **Technical logic:** Chat session persisted; context assembled from memory (`31`) + retrieved store facts; tool-calling with typed schemas; streaming via server-sent events/stream response (`15`, `21`). Token budget enforced (`16`).
- **States:** idle/empty (suggested prompts), thinking (agent/tool status visible), streaming, action-offered, error/degraded (`40`).
- **Edge cases:** model outage → cached-context Suggest-only + banner; ambiguous request → clarifying question; out-of-scope request → polite refusal + redirect; prompt-injection via store data → sanitized, tools gated (`32`).
- **Security:** no unvalidated write access; injection defenses; PII minimization; per-shop isolation.
- **Data:** `ChatSession`, `ChatMessage`, `ToolCall` (`18`).
- **Acceptance:** streams within latency budget; every action approved+audited; degrades gracefully.

## F-04 · Automations / Workflows (V1)
- **Summary:** Merchant enables recurring or triggered agent behaviors (e.g., "auto-add alt text to new products," "weekly SEO sweep," "low-stock alerts").
- **Business logic:** Automation = trigger (schedule/webhook/event) + agent task + autonomy level + guardrails (caps, allowlist). Suggest/Approve/Auto per trust ladder.
- **Technical logic:** Triggers from webhooks (`24`), schedules (BullMQ repeatable jobs, `17`), or events. Each run is a job with budget + audit. Kill-switch per automation and global.
- **States:** enabled/paused/error; per-run history.
- **Edge cases:** runaway loops (dedupe + caps), overlapping runs (locks), webhook storms (debounce), scope revoked (auto-pause).
- **Acceptance:** every automation reversible/gated; global + per-automation kill-switch; full run audit.

## F-05 · Billing & Plans
- **Summary:** Plan selection, trial, AAC metering, usage caps, upgrade/downgrade.
- **Business logic:** Plans/limits per `02`/`27`; AAC consumed per agent task; overage metered with hard cap.
- **Technical logic:** Shopify Billing API (app subscription + usage records); entitlement checks gate features; metering pipeline aggregates AAC per shop (`27`, `29`).
- **Edge cases:** trial end, proration, downgrade mid-cycle, cap reached (block + prompt upgrade, never surprise-charge), refunds.
- **Acceptance:** correct entitlement gating; no bill-shock; passes Billing review (`43`).

## F-06 · Notifications & Digests (V1)
- Findings, executed actions, outcomes, alerts via in-app + email; frequency controls; per `28`.
- **Edge cases:** notification fatigue (batching/digest), unsubscribe, failed email delivery, quiet hours.

## F-07 · Reporting & ROI (V1)
- Weekly MAVD report, action history, exportable; per `30`.
- **Edge cases:** attribution uncertainty (label confidence), sparse data (show ranges).

## F-08 · Onboarding
- Guided first scan + first action; progressive disclosure; per `06`/`09`.

## F-09 · Settings & Governance
- Autonomy levels per agent, budgets/caps, notification prefs, roles/seats (`26`), data controls (`44`), uninstall/export.
- **Edge cases:** conflicting settings, downgrade removes access to configured autonomies (gracefully pause).

## F-10 · Compliance (launch-blocking)
- GDPR data-request/redact flows, audit exports, retention timers (`24`, `44`).

## Cross-cutting acceptance criteria
- No feature ships without: empty/loading/error states; telemetry; audit for mutations; a11y pass; perf budget; docs update (`00` DoD).

## Feature → agent → doc traceability
| Feature | Primary agent(s) | Key docs |
|---|---|---|
| F-01/02 | Store Health, SEO, CRO, Content | 14,16,22 |
| F-03 | Orchestrator + all | 15,16,31 |
| F-04 | Workflow + domain agents | 17,24 |
| F-05 | — | 27 |
| F-06/07 | Analytics | 28,29,30 |
| F-08/09/10 | — | 09,26,44 |

## Maintenance
Specs versioned with PRD; each F-ID maps to test IDs (`36`). New features get an F-ID and full spec before code.
