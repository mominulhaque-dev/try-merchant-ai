# 25 — Authentication

## Purpose
Define authentication + session management: Shopify OAuth, session tokens for embedded requests, online vs offline tokens, expiring-offline-token handling, and session storage — grounded in the actual `@shopify/shopify-app-react-router` config.

## Ground truth
- `app/shopify.server.ts`: `shopifyApp({ authPathPrefix: "/auth", sessionStorage: PrismaSessionStorage(prisma), distribution: AppStore, future.expiringOfflineAccessTokens: true })`. Exposes `authenticate`, `unauthenticated`, `login`, `registerWebhooks`, `addDocumentResponseHeaders`.
- `prisma` `Session` model stores tokens incl. `refreshToken`/`refreshTokenExpires` (supports expiring offline tokens).
- OAuth already works (per project status). Auth routes under `app/routes/auth.*`.

## Goals
- Correct, secure embedded-app auth on every request.
- Robust offline-token lifecycle (issue, store, refresh, revoke).
- No security regressions vs. Shopify's managed flow.

## Auth model overview
Shopify apps authenticate in layers:
1. **OAuth (install/authorize)** — grants the app access + issues tokens. Handled by the library at `authPathPrefix="/auth"`. Uses Shopify **managed install** where applicable.
2. **Session tokens (per request, embedded)** — App Bridge issues short-lived JWT session tokens; the server validates them on each embedded request via `authenticate.admin(request)`. This is how we know *who* is calling without cookies in the iframe.
3. **Access tokens (Admin API)** — **online** (user-scoped, short-lived) and **offline** (shop-scoped, long-lived) tokens used to call Admin GraphQL.

## Online vs offline tokens
- **Offline token:** shop-scoped, used for **background jobs, automations, webhooks-triggered work** (no user present). Stored in Session storage. This is what agents use when acting unattended (`16`,`17`).
- **Online token:** user-scoped, used for interactive requests where user identity/permissions matter.
- We default to offline for durable agent work + online context for interactive Admin actions where user attribution matters.

## Expiring offline tokens (`future.expiringOfflineAccessTokens`)
- Enabled → offline tokens **expire** and must be **refreshed** via refresh token (`Session.refreshToken`, `refreshTokenExpires`).
- **We MUST:** detect expiry/`401 invalid token`, refresh transparently before/at use, persist the new token, and retry the operation. Jobs handle refresh so unattended work never fails silently (`17`,`40`).
- If refresh fails (revoked/uninstalled) → stop shop's work, mark session invalid, require re-auth (`26` scope flow / re-install).

## Session tokens (embedded requests)
- Every embedded loader/action calls `authenticate.admin(request)` → validates the App Bridge session token (JWT signed with app secret), resolves shop + user, returns an authenticated Admin GraphQL client.
- Client fetches automatically include the session token (App Bridge / RR7 package). No manual cookie handling.
- Invalid/expired session token → library triggers re-auth/redirect; UI handles transparently.

## Session storage
- `PrismaSessionStorage` persists sessions in Postgres (`Session` model, `18`). Keep the model **adapter-compatible** — do not remove fields the adapter requires.
- Tokens at rest: rely on managed DB encryption + treat the DB as sensitive; consider column-level encryption for `accessToken`/`refreshToken` (`32`).

## OAuth scopes & consent
- Scopes from env `SCOPES` (mirrors `shopify.app.toml`). Requested at install; additional scopes requested progressively (`22`,`26`) → re-consent flow → `scopes_update` webhook (`24`).

## Document response headers / embedding
- `addDocumentResponseHeaders` (wired) sets CSP `frame-ancestors` + needed headers so the app embeds correctly in Admin and isn't clickjacked. Do not strip these.

## Auth-related routes
| Route | Role |
|---|---|
| `app/routes/auth.$.tsx` (or auth splat) | OAuth begin/callback (library) |
| `app/routes/app.tsx` | Requires `authenticate.admin`; shell for embedded app |
| `app/routes/webhooks.*` | `authenticate.webhook` (HMAC, `24`) |
| `app/routes/api.*` | `authenticate.admin`/internal auth |

## Multi-user / seats (`26`)
- A shop may have multiple staff. Online tokens carry user identity; we map users → roles for RBAC (seats/governance). Account owner vs. staff vs. collaborator flags exist on `Session`.

## Security (`32`)
- Validate session token signature + `dest`/`aud`/exp on every request (library does this — don't bypass).
- Never expose tokens to the client; all Admin calls server-side (`21`).
- HMAC on webhooks + OAuth callback; state param / nonce on OAuth (library-managed).
- Rotate/revoke on uninstall; invalidate sessions on `app/uninstalled` (`24`).
- Secrets (`SHOPIFY_API_SECRET`) from env/secret manager only.
- Protect against token theft: short-lived session tokens, encrypted storage, least-privilege scopes.

## Edge cases
- **Offline token expired mid-job** → refresh + retry; if refresh fails → halt + require re-auth (`40`).
- **App reinstall** → new tokens; reconcile session; don't duplicate shop records (upsert by domain).
- **Scope change** → re-auth for new scopes; pause features needing not-yet-granted scopes (`26`).
- **Session token clock skew** → allow small leeway per library; else re-auth.
- **Uninstalled shop still has jobs** → tokens invalid → jobs cancelled (`17`,`24`).
- **Collaborator/staff with limited Shopify permissions** → respect Shopify's permissions; our RBAC is additive, never bypasses Shopify's.

## Testing (`36`)
- OAuth install/callback e2e on dev store; session-token validation tests (valid/expired/tampered); offline-token refresh tests (expiry → refresh → retry); uninstall → session invalidation; scope-update re-auth; webhook HMAC (`24`). Negative tests for tampered tokens.

## Future expansion
SSO/SAML for enterprise seats, org-level auth for agencies (multi-store), and step-up auth for high-risk autonomous actions (`50`,`26`).

## Decisions (ADR)
- **ADR-025-1:** Offline tokens power unattended agent work; refresh handled in jobs (expiring-offline-tokens on).
- **ADR-025-2:** Never bypass the library's session-token validation; all Admin access server-side.
- **ADR-025-3:** Keep `Session` model adapter-compatible; encrypt token columns at rest.

## Maintenance
Owned by Security + Backend. Any auth change reviewed by Security. Re-verify token lifecycle each Shopify library upgrade; keep refresh handling covered by tests.
