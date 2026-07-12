# Active Task

**M1.T12 — GDPR / mandatory compliance webhooks** (docs/24, docs/43, docs/44). ✅ Done this session (Docker still unavailable; the named fallback tasks are gated on the tool catalog/DB, so this launch-blocking, fully-non-blocked item was the best increment).

The three compliance topics required for App Store approval, verified/audited/idempotent:

- `app/lib/domain/compliance/gdpr.server.ts` — a port-based, unit-testable core: `ComplianceStore` (deleteShopSessions / deleteCustomerData / collectCustomerData) + `redactShop`/`redactCustomer`/`collectCustomerData` + payload extractors (`extractCustomerId`, `extractDataRequestId`) + a `prismaComplianceStore(db)` adapter.
- `app/routes/webhooks.shop.redact.tsx` — deletes the shop's `Session` rows.
- `app/routes/webhooks.customers.redact.tsx` / `webhooks.customers.data_request.tsx` — the app persists **no customer PII** (PII-minimized by design, docs/32), so these truthfully act on nothing and audit the request; they gain real deletions/collection unchanged once customer-scoped tables land (docs/18).
- All three: HMAC-verify via `authenticate.webhook`, audit via the scrubbing logger (docs/41), 200-ack, and 500-on-failure so Shopify retries (~48h backoff).
- `shopify.app.toml` — enabled `compliance_topics` subscriptions for the three URIs (previously commented out).

**Verification (ran this session):** `npm run typecheck` ✅ · `npm run test` ✅ (101 tests, 13 files — 8 new GDPR tests: payload extraction, shop redact, customer redact/collect with a fake store) · `npm run build` ✅. `npm run lint` still env-blocked (native TS import-resolver addon — repo-wide, not code). Live webhook delivery/HMAC not exercised here (needs `npm run dev`/deploy); the compliance audit trail is structured logs until the DB cutover adds durable rows.
