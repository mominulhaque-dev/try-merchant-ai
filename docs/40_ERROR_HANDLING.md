# 40 — Error Handling

## Purpose
Define how errors are classified, surfaced, recovered from, and prevented — across UI, API, jobs, AI, and Shopify integration. Given we mutate live stores, graceful, reversible failure is a safety requirement (`00` P3).

## Goals
- No silent failures; no data loss; no half-applied mutations left dangling.
- User-safe, actionable error messaging (never raw internals).
- Automatic recovery where possible; safe degradation otherwise.

## Error taxonomy (aligns with `19`)
| Class | Examples | Handling |
|---|---|---|
| **Validation** | bad input, schema mismatch | reject early, inline message, preserve input |
| **Auth/Authz** | expired session, missing scope, wrong role | re-auth / request scope / explain (`25`,`26`) |
| **Entitlement** | plan/cap exceeded | upsell, don't crash (`27`) |
| **Conflict** | concurrency, stale preview | re-preview, optimistic-concurrency retry |
| **Rate/Throttle** | Shopify `THROTTLED`, provider limits | backoff + queue + retry (`22`,`16`) |
| **Provider** | model outage/timeout | failover → cheap → Suggest-only degrade (`15`) |
| **Integration** | Shopify API error, webhook fail | retry, reconcile, alert (`24`) |
| **Budget** | AAC/token cap | pause + notify, no overrun (`00` P7) |
| **Transient infra** | DB/Redis blip | retry w/ backoff, circuit breaker |
| **Bug/Internal** | unexpected | catch, log, safe fallback, alert |
Each error carries: `code`, user-safe `message`, `retryable`, `traceId` — never leak stack/PII (`32`,`41`).

## Principles
1. **Fail safe + reversible:** a failed mutation must roll back partials or be clearly incomplete + resumable; never leave the store half-changed silently.
2. **Degrade, don't die:** AI/provider/Redis failures → reduced functionality (Suggest-only, cached), not an error page.
3. **Idempotent recovery:** retries never double-apply (idempotency keys, optimistic concurrency, `17`).
4. **User-first messaging:** plain language, cause + next step, preserve their work.
5. **Observe everything:** every handled error is logged + counted; spikes alert (`39`).

## UI error handling (`21`,`11`)
- Route-level `ErrorBoundary` + `HydrateFallback` (RR7): friendly recovery UI, retry, support link — never a blank crash.
- Expected failures returned as typed **states** (not thrown) → rendered as inline banners with retry, preserving form input.
- Toasts for transient errors; banners for persistent; degraded banner for AI outage (`13` `DegradedBanner`).
- Optimistic UI rolls back visibly on failure.

## API error handling (`19`)
- Consistent error envelope + codes; correct HTTP status; `retryable` hint; `traceId`. Validate inputs (Zod) → reject early. No internal detail leakage.

## Job/worker error handling (`17`)
- Retries with exponential backoff + jitter; max attempts per type; **poison → DLQ + alert**.
- **Transactional writes:** action + audit committed atomically; on failure, roll back; partial multi-item ops report per-item status + roll back or mark incomplete.
- Circuit breakers around providers/Shopify; graceful abort + notify on breaker open.
- On scope-revoked/uninstall mid-job → abort, roll back reversible partials, notify (`24`,`26`).

## AI error handling (`15`,`16`)
- Provider failover chain (primary → secondary → cheap → Suggest-only from cache).
- Malformed tool args → schema validation rejects → retry/repair or abort (never execute invalid).
- Model hallucination guard: policy layer + validation catch impossible/unauthorized actions before execution.
- Timeout/abort (user stop) → cancel provider call, free budget.
- Budget exceeded → stop + explain + upsell.

## Shopify integration errors (`22`,`24`)
- `THROTTLED` → backoff per restore rate + queue. Token invalid → refresh (`25`) or halt. Bulk-op failure → retry/reconcile. Webhook processing failure → rely on Shopify retry + our reconciliation sync. API deprecation → surfaced by codegen, fixed pre-sunset.

## Reversibility & the undo spine (`00` P3)
- Every executed mutation registers before-state + undo token (`18`). Failed executions roll back partials. Irreversible actions gated by explicit confirm (never auto below guarded). "Undo + Report" affordance on any action gone wrong (`09` Flow 8).

## Incident-grade errors (`32`,`48`)
- Widespread failures → global kill-switch (halt agents), status page (`47`), incident runbook (`48`), customer comms. Security-relevant errors (auth/HMAC spikes) → security response (`32`).

## Prevention
- Strong typing + validation at boundaries; exhaustive state handling (`11`); tests for every edge case (`36`); safe defaults; circuit breakers; timeouts on all external calls; no unbounded operations.

## Edge cases (must-handle)
- Stale preview → re-preview (conflict).
- Duplicate submit/webhook/job → idempotent no-op.
- Provider down mid-stream → graceful stop + degrade banner, session preserved.
- DB/Redis blip → retry; if sustained → degrade + alert, no data loss (durable state in PG).
- Partial bulk failure → per-item results + targeted retry/rollback.
- User navigates away mid-action → settle safely (job continues or cancels cleanly).
- Migration failure on deploy → halt + rollback (`38`).

## Testing (`36`)
- Fault injection (provider/DB/Redis/Shopify failures), idempotency/double-delivery, rollback-on-failure, concurrency conflict, budget-exceeded, scope-revoked-mid-job, ErrorBoundary rendering, degraded-mode, and DLQ handling. Chaos tests for worker kill mid-job.

## Future expansion
Self-healing (auto-retry playbooks), user-facing incident timelines, AI-assisted error diagnosis, and automated rollback on error-rate SLO breach (`38`,`50`).

## Decisions (ADR)
- **ADR-040-1:** No half-applied mutations — failures roll back partials or mark clearly incomplete + resumable.
- **ADR-040-2:** AI/infra failures degrade functionality (Suggest-only/cached), never a crash.
- **ADR-040-3:** All retries idempotent; user-facing errors never leak internals or PII.

## Maintenance
Owned by Eng. Every feature enumerates its failure modes + recovery in its spec (`07`) + tests. Error taxonomy kept synced with `19`. Post-incident, add the missed case to tests (`48`).
