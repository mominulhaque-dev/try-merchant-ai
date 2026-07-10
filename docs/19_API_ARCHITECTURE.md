# 19 — API Architecture

## Purpose
Define the API surfaces: internal app APIs (loaders/actions + JSON/stream endpoints in React Router 7), the typed AI **tool** API (how agents touch the world), Shopify Admin GraphQL consumption, and any public API. Includes contracts, versioning, auth, errors, and rate limits.

## Goals
- One coherent, typed, authenticated API layer; no ad-hoc fetch.
- Agent tools as a first-class, versioned, validated API (the deterministic rail, `16`).
- Clear boundaries: request-path (fast) vs. queued work (`17`).

## API surfaces
1. **Route data APIs (React Router 7)** — `loader` (reads) + `action` (writes) colocated with routes. Primary way the embedded UI talks to the server. Server-only, session-token authenticated (`25`).
2. **JSON/stream endpoints** — `app/routes/api.*` for things not tied to a page: `POST /api/copilot/stream` (SSE), `POST /api/scans`, `GET /api/scans/:id`, `POST /api/actions/:id/approve`, etc.
3. **Agent Tool API (internal)** — typed functions agents may call (`16`); not HTTP-exposed to clients; invoked inside the runtime/workers.
4. **Shopify Admin GraphQL (outbound)** — via the authenticated client from `authenticate.admin(request)` (`22`).
5. **Webhook endpoints** — `app/routes/webhooks.*` (`24`).
6. **Public API (future)** — for agencies/integrations; versioned REST/GraphQL with API keys + scopes.

## Design principles
- **Typed end-to-end:** TS types shared between loader/action and UI; tool args/results via JSON schema + Zod; GraphQL via codegen (`graphql-codegen` already in scripts) for typed Admin queries.
- **Thin request path:** loaders/actions do auth + light reads/writes; anything heavy (AI, bulk) → enqueue a job (`17`) and return a job handle to poll/stream.
- **Idempotency:** mutating endpoints accept idempotency keys; retries safe.
- **Consistent envelopes + errors** (below).
- **Least privilege:** every endpoint checks scope + plan entitlement + tenant.

## Route data API contract
- `loader({request})`: `authenticate.admin(request)` → returns typed data; supports deferred/streamed values for slow parts (`21`,`14`).
- `action({request})`: authenticate → validate (Zod) → perform or enqueue → return typed result or redirect. Never trust client input.
- Errors thrown → route `ErrorBoundary` (`40`); expected failures returned as typed result states.

## JSON/stream endpoint contract
- Auth: session token (embedded) or, for background-triggered, internal auth. Reject unauthenticated.
- Request/response validated (Zod). 
- **Streaming** (`/api/copilot/stream`): Server-Sent Events / chunked; events `token|tool_call|tool_result|action_offer|citation|done|error` (`15`). Heartbeats; client can abort (stop-generation).
- Standard envelope:
```json
{ "ok": true, "data": { }, "meta": { "traceId": "...", "asOf": "ISO" } }
{ "ok": false, "error": { "code": "SCOPE_MISSING", "message": "...", "retryable": false }, "meta": { "traceId": "..." } }
```

## Agent Tool API (typed rails)
- Each tool: `name`, `input` schema, `output` schema, `sideEffect: 'read'|'mutation'`, `requiredScopes`, `requiredPlan`, `cost` (AAC). Registered in a central **tool catalog**; agents reference tools by name from their allowlist (`16`).
- **Read tools** execute directly (rate-limited). **Mutation tools** return a proposed `Action` → action pipeline (preview→approve→execute→audit→undo). No tool bypasses the policy layer.
- Versioned: adding/removing a tool or changing its schema is a reviewed change (Security sign-off for new grants).
- Example tools: `products.list`, `product.get`, `product.updateSeo` (mutation), `image.setAlt` (mutation), `orders.summary`, `inventory.risk`, `theme.get`, `analytics.metric`, `automation.create`.

## Shopify Admin GraphQL consumption (`22`)
- Always via `authenticate.admin(request).admin.graphql(...)` (offline token for background; online for interactive).
- Pinned API version `2025-10` (`app/shopify.server.ts`); roll forward deliberately.
- Cost-aware: respect GraphQL query cost + throttle (`22`); use **Bulk Operations** for large reads/writes; paginate with cursors.
- Typed via `graphql-codegen` (`.graphql` documents → TS types).

## Versioning
- **Internal APIs:** evolve with the app; breaking changes coordinated in one repo (no external consumers) but tool schemas versioned for agent stability.
- **Shopify API:** version pinned + tracked per Shopify quarterly release; upgrade PRs run codegen + tests (`43`).
- **Public API (future):** semver + `/v1` path; deprecation policy + sunset headers.

## Auth & tenancy (`25`,`26`,`32`)
- Embedded requests: Shopify **session tokens** (App Bridge) validated server-side; offline tokens for background.
- Every request resolves a `shop` and enforces tenant isolation + scope + plan entitlement before any data access.
- Webhooks: **HMAC verification** mandatory (`24`).

## Rate limiting & quotas
- Per-shop rate limits on expensive endpoints (scan, copilot) + AAC budget checks (`27`).
- Outbound Shopify throttling honored (backoff on `THROTTLED`).
- Provider (OpenAI/Anthropic) rate limits handled with queueing + failover (`16`).

## Errors (taxonomy → `40`)
Codes: `UNAUTHENTICATED`, `SCOPE_MISSING`, `PLAN_REQUIRED`, `RATE_LIMITED`, `THROTTLED_SHOPIFY`, `VALIDATION`, `CONFLICT` (concurrency), `PROVIDER_UNAVAILABLE`, `BUDGET_EXCEEDED`, `NOT_FOUND`, `INTERNAL`. Each carries `retryable` + user-safe message. Never leak internals/PII.

## Observability (`39`,`41`)
- `traceId` generated per request, propagated to jobs + tool calls + logs.
- Metrics: latency, error rate, throttle rate, tokens/cost per endpoint.

## Security (`32`)
- Input validation everywhere; output encoding; no SSRF from tool inputs; secrets from env/secret store; CORS locked; SSE authenticated; no PII in error/log payloads; injection defenses on model-facing surfaces (`15`).

## Edge cases
- Client aborts stream → cancel model call, free budget.
- Shopify throttled → backoff + retry via queue, inform UI.
- Concurrency conflict → `CONFLICT` + re-preview.
- Provider down → `PROVIDER_UNAVAILABLE` + degraded mode (`40`).
- Idempotent retry of an already-executed action → return prior result, no double-apply.

## Testing (`36`)
Contract tests (envelopes, error codes), Zod schema tests, tool-schema validation + allowlist enforcement, streaming tests (abort, heartbeat), auth/tenant-isolation tests, and Shopify GraphQL integration tests (mocked + against dev store).

## Future expansion
Public partner API + webhooks-out, GraphQL gateway for our own API, MCP server exposing our tools to external models, and per-plan API quotas (`50`).

## Maintenance
Owned by Backend. New endpoints/tools require: schema, auth+entitlement checks, error mapping, telemetry, tests, and doc entry. Tool grant changes require Security review.
