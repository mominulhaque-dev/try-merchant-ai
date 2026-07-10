# 21 — Frontend Architecture

## Purpose
Define the frontend architecture on the **actual** stack — **React Router 7** (not Remix), React 18, TypeScript, Polaris, App Bridge — including data loading, state, streaming, and performance.

## Ground truth
`package.json`: `react-router@7.12`, `@react-router/{dev,fs-routes,node,serve}@7.12`, `@shopify/app-bridge-react@4`, `@shopify/shopify-app-react-router@1.1`, React 18, Vite 6, TS 5.9. Routes use `@react-router/fs-routes` conventions. This is the framework of record (`00` ADR-000-1). Docs that say "Remix" are wrong — treat RR7 loaders/actions as the model (API-compatible lineage, different package).

## Goals
- Server-driven data via loaders/actions; minimal client state.
- Native Polaris + App Bridge; embedded-app correctness.
- Fast, accessible, streaming-capable UI within `33`/`34` budgets.

## Rendering & routing model
- **SSR + progressive enhancement** via React Router 7 framework mode (Vite). Routes in `app/routes/**` (fs-routes).
- **Loaders** fetch data server-side (authenticated, `25`); **actions** handle mutations. Data flows down as typed loader data; forms post to actions.
- **Nested routes + layouts:** `app.tsx` is the authenticated shell (NavMenu, App Bridge provider); children are feature screens (`10`).
- **Deferred/streaming data:** heavy, below-the-fold data returned as promises and streamed (`Await`/Suspense) so the shell paints fast (`14`).
- Navigation via App Bridge-aware links (embedded, no full reloads).

## App Bridge & embedding (`22`,`25`)
- App Bridge React provider at the root of the authenticated shell; provides session-token auth for fetches, `TitleBar`, `NavMenu`, toasts, modals, resource pickers, SaveBar.
- All server fetches carry the session token (handled by the Shopify RR7 package's authenticated fetch). Never assume first-party cookies in the iframe.

## State management
- **Server state is the source of truth** (loaders). Prefer revalidation over client caches.
- **Client state** minimal: UI-only (open modals, form drafts, chat composer) via React state/context. No heavy global store (Redux) unless a real need appears.
- **Forms:** React Router `Form`/`useFetcher` for mutations; optimistic UI where safe; App Bridge SaveBar for batched settings.
- **Streaming chat state** (`15`): a dedicated hook manages the SSE connection, appends tokens/tool events, exposes stop-generation; messages persisted server-side.

## Component architecture (`13`)
- Polaris-first; custom components in `app/components/**` by domain; route modules compose them.
- Presentational components pure; data comes via loader props or fetchers, not internal fetches.
- Route-level `ErrorBoundary` + `HydrateFallback` for errors/loading (`40`).

## Data fetching patterns
- **Reads:** loader → typed data. Use deferred promises for slow parts.
- **Writes:** action or fetcher → typed result; revalidate affected loaders.
- **Polling:** for job status (scan/action), poll a lightweight `api.*` status endpoint or subscribe via stream (`19`).
- **No N+1 to Shopify** from the client — all Shopify access is server-side (`22`).

## Performance (`33`)
- Route-based code splitting (Vite) + lazy-load heavy screens (charts, chat).
- Skeletons over spinners; avoid layout shift; virtualize long lists (findings, audit).
- Cache-friendly loaders; revalidate on focus; debounce filters (URL search params).
- Keep the embedded bundle lean; defer non-critical JS; measure with Web Vitals in-app (`39`).
- Optimistic UI for reversible actions to feel instant.

## Accessibility (`34`)
- Polaris handles most a11y; we add: focus management on route/modal change, `aria-live` for streaming + async results, keyboard support for custom components, visible focus, no color-only meaning, reduced-motion support.

## Internationalization (`34`,`50`)
- Locale from Admin; format currency/dates/numbers via Intl; externalize strings; layouts tolerate long strings + RTL.

## Error & empty states (`11`,`40`)
- Every route defines empty/loading/error/degraded UI. Route `ErrorBoundary` renders friendly recovery; expected states returned as data, not thrown.

## Security (frontend) (`32`)
- No secrets in client bundle; all privileged calls server-side; trust nothing from the client in actions; sanitize/encode rendered content; CSP + embedding headers (`addDocumentResponseHeaders` already wired in `shopify.server.ts`).

## TypeScript & quality
- `npm run typecheck` (react-router typegen + tsc) and `npm run lint` gate merges. Strict types; loader/action data typed via RR7 typegen; GraphQL types via codegen (`19`).

## Testing (`36`)
- Unit (components, hooks), route tests (loader/action behavior), interaction (Testing Library), visual regression, a11y automated + manual, e2e for critical flows (onboarding, fix-it+undo, chat, billing).

## Edge cases
- iframe/embedded quirks (cookies, storage) → rely on session tokens + App Bridge.
- Slow/deferred data → skeletons + streamed reveal; never block shell.
- Stream drop/reconnect (chat) → resumable/graceful (`15`).
- Route change mid-action → cancel/settle safely.
- Dark mode/merchant theme → Polaris tokens (`11`).

## Future expansion
Command palette, offline-tolerant reads, richer real-time (websockets) for live agent activity, admin extension surfaces (`23`), and micro-frontends only if scale demands (`50`).

## Decisions (ADR)
- **ADR-021-1:** React Router 7 framework mode; server-driven data (loaders/actions) is the default; minimal client state.
- **ADR-021-2:** All Shopify + privileged access is server-side; the client holds no secrets and no Admin tokens.

## Maintenance
Owned by FE. New screens: define states + loader/defer strategy + a11y + telemetry here/`14`. Keep route list synced with `10`. Re-audit on Polaris/App Bridge/RR7 upgrades.
