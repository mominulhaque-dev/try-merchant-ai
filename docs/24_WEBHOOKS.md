# 24 — Webhooks

## Purpose
Define webhook subscriptions, verification, processing, and the mandatory GDPR compliance topics. Webhooks keep our data fresh, trigger automations, and are **required** for App Store approval.

## Ground truth
`shopify.app.toml` currently subscribes: `app/uninstalled` (→ `/webhooks/app/uninstalled`) and `app/scopes_update` (→ `/webhooks/app/scopes_update`). GDPR compliance topics are present but **commented out** — they MUST be enabled before public launch (`43`). Handlers live in `app/routes/webhooks.*`. API version `2025-10`.

## Goals
- Verified, idempotent, fast-ack webhook processing.
- Complete GDPR compliance webhook implementation.
- Fresh caches + timely automation triggers.

## Subscription strategy
Two mechanisms:
1. **App-level (declarative) in `shopify.app.toml`** — for shop-wide topics (uninstall, scopes update, compliance). Registered on deploy.
2. **Programmatic** (`registerWebhooks`) if per-shop dynamic subscriptions are needed. Prefer declarative for stability.

## Required subscriptions

### Mandatory / compliance (enable before public launch)
| Topic | URI | Purpose |
|---|---|---|
| `app/uninstalled` | `/webhooks/app/uninstalled` | Teardown: cancel jobs, invalidate tokens, start retention timer (`42`,`44`) — **exists** |
| `app/scopes_update` | `/webhooks/app/scopes_update` | React to scope grant/revoke (`26`) — **exists** |
| `customers/data_request` | `/webhooks/customers/data_request` | GDPR: compile + provide customer data (`44`) — **ADD** |
| `customers/redact` | `/webhooks/customers/redact` | GDPR: delete customer PII (`44`) — **ADD** |
| `shop/redact` | `/webhooks/shop/redact` | GDPR: delete shop data 48h+ after uninstall (`44`) — **ADD** |

### Functional (add as features need them)
| Topic | Purpose |
|---|---|
| `products/create|update|delete` | Refresh catalog cache; trigger SEO/Content agents on new products |
| `orders/create|updated` | Analytics, inventory velocity, MAVD attribution |
| `inventory_levels/update` | Inventory Agent stockout/overstock signals |
| `themes/publish|update` | Theme Agent baseline refresh |
| `bulk_operations/finish` | Drive bulk-op processing (`22`) |
| `app_subscriptions/update` | Billing state sync (`27`) |
| `customers/create|update` | Support/segmentation (PII-minimized) |
Apply **webhook filters** (e.g., price thresholds) where supported to reduce noise (`shopify.app.toml` supports `filter`).

## Processing pipeline (mandatory pattern)
```
Shopify → POST /webhooks/* 
  → authenticate.webhook(request)  // HMAC verify + parse (32)
  → FAST ACK 200 immediately
  → enqueue to `webhook` queue (17) with idempotency key
Worker:
  → dedupe (idempotencyKey = topic + shop + payload id + eventId)
  → validate payload schema
  → apply (cache invalidation / trigger agent task / compliance action)
  → audit (41) for compliance + mutations
```
- **Verify first:** every webhook MUST pass HMAC verification (`authenticate.webhook`); reject invalid → 401. Never trust an unverified webhook.
- **Ack fast:** return 200 within Shopify's timeout; do all real work in the queue (`17`). Slow handlers → Shopify retries → duplicates.
- **Idempotent:** Shopify delivers **at least once**; dedupe + idempotent handlers = effectively-once (`17`).
- **Reliable:** Shopify retries failed deliveries with backoff (up to ~48h). If we're down, we recover on retry; also reconcile via periodic sync for critical data.

## Compliance handlers (detail) (`44`)
- `customers/data_request`: gather all data we hold for that customer (usually minimal — we minimize PII), package, and make available to the merchant within the legal window; audit the request.
- `customers/redact`: hard-delete/anonymize that customer's PII across all shop-scoped tables (`18`); audit.
- `shop/redact`: (fires ≥48h after uninstall) delete all shop data per retention policy; audit; confirm teardown.
- `app/uninstalled`: mark shop uninstalled, cancel queued jobs, invalidate offline token, stop billing, start `shop/redact` retention timer, send offboarding email w/ export offer.

## Security (`32`)
- HMAC verification on 100% of webhooks; reject on mismatch.
- Endpoints are unauthenticated by session (Shopify calls them) but authenticated by HMAC — no other trust.
- Validate + sanitize payloads; never execute model instructions from webhook content (injection, `15`).
- Rate/volume protection: debounce webhook storms per shop+resource (`17`).
- Log with `traceId`; no PII in logs (`41`).

## Observability (`39`)
- Metrics: receipt rate, verification failures, processing latency, retry/duplicate rate, DLQ depth per topic. Alert on verification-failure spikes (possible attack) or processing backlog.

## Edge cases
- **Duplicate delivery** → idempotency dedupe.
- **Out-of-order delivery** → use payload timestamps/versioning; last-writer-wins with version guard for cache.
- **Webhook storm** (bulk edit) → coalesce/debounce per shop+resource.
- **Missed webhook** (we were down) → Shopify retries + periodic reconciliation sync for critical entities.
- **Uninstall during active jobs** → cancel + teardown (`17`).
- **Scope revoked** → `scopes_update` handler pauses dependent features (`26`).
- **Compliance webhook for unknown customer** → respond success (nothing to delete), audit.

## Testing (`36`)
- HMAC verification tests (valid/invalid/replay), handler unit tests per topic, idempotency/duplicate tests, compliance-flow integration tests (data_request/redact actually export/delete), fast-ack tests, DLQ + retry tests. Verify against dev store deliveries.

## Future expansion
More granular topics as features grow, EventBridge/PubSub delivery (Shopify supports) for scale, and webhook-driven real-time agent reactions (`50`).

## Decisions (ADR)
- **ADR-024-1:** Verify (HMAC) → fast-ack → enqueue; no real work in the handler.
- **ADR-024-2:** GDPR compliance topics are launch-blocking; implemented + tested before public submission.
- **ADR-024-3:** At-least-once + idempotency; plus periodic reconciliation for critical data.

## Maintenance
Owned by Backend. New topic = declarative subscription + verified handler + idempotent worker + audit (if compliance/mutation) + tests. Re-verify compliance topics each Shopify release (`43`).
