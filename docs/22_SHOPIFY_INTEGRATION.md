# 22 — Shopify Integration

## Purpose
Define how TryMerchantAI integrates with Shopify: Admin GraphQL, API versioning, rate/cost management, bulk operations, extension surfaces, and platform primitives (Metaobjects, Functions, Flow). Grounded in the actual `@shopify/shopify-app-react-router` setup.

## Ground truth
- `app/shopify.server.ts`: `shopifyApp({ apiVersion: October25, distribution: AppStore, future.expiringOfflineAccessTokens: true, sessionStorage: PrismaSessionStorage })`. API version pinned **2025-10**.
- `shopify.app.toml`: scopes `write_products, write_metaobjects, write_metaobject_definitions`; example metaobject defs + demo product metafield; webhooks `app/uninstalled`, `app/scopes_update`; `api_version = 2025-10`.
- Workspaces include `extensions/*` (ready for extensions).

## Goals
- Read/write Shopify data safely, typed, and within rate/cost limits.
- Use the right primitive for each job (GraphQL, Bulk, Metaobjects, Functions, Flow, extensions).
- Keep API-version upgrades routine and safe.

## Admin API strategy
- **GraphQL Admin API only** (REST is legacy; GraphQL is Shopify's forward path). Access via `authenticate.admin(request).admin.graphql(...)`.
- **Online vs offline tokens:** interactive requests use online context; background jobs/automations use the **offline** token (with expiring-offline-tokens handling, `25`).
- **Typed queries:** `.graphql` documents + `graphql-codegen` (`@shopify/api-codegen-preset` already present) → typed operations. No untyped inline strings for non-trivial ops.

## Rate limit & cost management
- GraphQL uses a **calculated query cost** + leaky-bucket. We MUST:
  - Track `extensions.cost` (requested/actual, throttle status) on responses.
  - Back off on `THROTTLED` with the returned restore rate; retry via queue (`17`).
  - Keep queries lean (request only needed fields; avoid deep connections).
  - Cache stable reads (shop settings, catalog aggregates) with TTL + invalidation on webhooks (`24`).
- **Never** loop N single queries where a bulk op or a paginated connection fits.

## Bulk Operations (large catalogs)
- For large reads (all products/variants/inventory) and large writes, use the **Bulk Operations API** (async, JSONL result files). One bulk op per shop at a time → serialize via queue + lock (`17`).
- Flow: start bulk → poll status (webhook `bulk_operations/finish` or poll) → download JSONL → process in chunks → aggregate. Handles 100k+ SKU stores without timeouts.

## Pagination
- Cursor-based (`pageInfo.hasNextPage`, `endCursor`); page sizes tuned to cost; resumable in jobs.

## Platform primitives — when to use what
- **Metaobjects** (`write_metaobjects`): store app-defined structured data on the shop (e.g., our config, experiment definitions, agent-managed content) natively in Shopify so it's portable + merchant-visible. Template already defines example metaobjects — replace with real definitions.
- **Metafields:** attach app data to products/orders/etc. (e.g., "optimized-by-AI" flags, generated SEO). Use app-reserved namespaces; respect access controls.
- **Shopify Functions:** for logic that must run in Shopify's checkout/discount/delivery paths (e.g., discount or bundle logic the Marketing/Recommendation agents propose). Deployed as an extension; deterministic, fast, no external calls.
- **Shopify Flow:** integrate as triggers/actions so merchants can wire our agents into their existing Flow automations (and we can react to Flow triggers). Complements our automation engine (`17`).
- **Admin UI Extensions:** surface agent actions inside native Admin resource pages (e.g., an "Optimize with AI" block on a product page) for context-relevant UX (`23` covers storefront; admin extensions live in `extensions/*`).
- **Theme App Extensions / App Blocks:** storefront-side CRO/recommendation blocks without editing theme code (`23`).
- **Customer Accounts / B2B:** future surfaces (`50`).

## Scopes (least privilege, progressive) (`26`)
- Start minimal (current scopes). Request additional scopes **only when a feature needing them is enabled**, via scope update flow (`app/scopes_update` webhook already subscribed). Document every scope→feature mapping in `26`.
- Examples of likely additions as features ship: `read_orders`/`read_all_orders` (analytics, inventory), `read_customers` (support, minimized), `read/write_content` (blog/content agent), `read_inventory`/`write_inventory`, `read_themes`/`write_themes` (theme agent — gated), `read_reports`/`read_analytics`.

## Webhooks (`24`)
- Managed via `shopify.app.toml` + handlers in `app/routes/webhooks.*`. Currently: `app/uninstalled`, `app/scopes_update`. Must add: GDPR compliance topics (`customers/data_request`, `customers/redact`, `shop/redact`) before public launch, plus product/order/inventory topics to keep caches + agents fresh.

## API version management
- Pinned in `shopify.server.ts` + `shopify.app.toml` (`2025-10`). Shopify ships quarterly; each version supported ~1 year.
- **Upgrade process:** bump version → run codegen → run typecheck + integration tests against dev store → fix deprecations (Shopify surfaces deprecation warnings) → deploy. Track in `49`/`43`. Never let the pinned version go unsupported.

## Data freshness & caching
- Webhook-driven cache invalidation for catalog/inventory/orders; TTL fallback; "as of" timestamps in UI (`14`). Agents read fresh or clearly-stale data, never silently old.

## Security (`32`)
- Session-token auth on embedded requests; HMAC on webhooks; offline token stored encrypted in Session storage; scopes least-privilege; tenant isolation by shop; PII minimized before any model call.

## Edge cases
- Throttling / cost spikes → backoff + bulk + queue.
- Offline token expired (expiring-offline-tokens future) → refresh flow (`25`).
- Scope revoked → feature auto-pauses + re-request (`26`).
- API deprecations mid-cycle → codegen surfaces; fix before version sunset.
- Large store bulk op already running → serialize; don't start a second.
- Metaobject/metafield definition drift → migrations for our definitions; never clobber merchant data.

## Testing (`36`)
Integration tests against a dev store (OAuth, reads, a safe write + undo, bulk op), mocked GraphQL contract tests, throttle/backoff tests, webhook HMAC + handler tests, and version-upgrade smoke tests.

## Future expansion
POS, Markets (international), B2B/wholesale, Customer Accounts UI extensions, Hydrogen/headless read support, and deeper Functions usage as agents propose checkout-time logic (`50`).

## Decisions (ADR)
- **ADR-022-1:** GraphQL Admin API only; REST avoided.
- **ADR-022-2:** Bulk Operations for anything catalog-scale; serialized per shop.
- **ADR-022-3:** Scopes requested progressively per enabled feature; never pre-request.

## Maintenance
Owned by Shopify Solution Architect. Every new Shopify data need: pick the right primitive, minimal scope, typed query, cache/invalidation plan, tests. Re-verify each Shopify Edition (`43`).
