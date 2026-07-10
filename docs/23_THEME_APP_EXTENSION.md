# 23 — Theme App Extension

## Purpose
Specify our storefront-side integration via **Theme App Extensions** (app blocks/embeds) so agents (CRO, Recommendation) can improve the live storefront **without editing theme code** — the Shopify-approved, upgrade-safe way.

## Goals
- Storefront enhancements (recommendations, trust badges, CRO widgets, experiments) that merchants add via the theme editor.
- Zero theme-code modification; Online Store 2.0 compatible; performant + accessible.
- Safe, reversible: adding/removing a block is a theme-editor toggle, and publishing is merchant-controlled.

## What a Theme App Extension gives us
- **App blocks** — merchant drags our block into a section (e.g., "AI Recommendations" on a product/collection page).
- **App embed blocks** — global embeds (e.g., a lightweight analytics/CRO helper) toggled on app-wide.
- Assets served from Shopify's CDN; settings via schema; Liquid + JS/CSS bundled in the extension under `extensions/*` (workspace already configured).

## Planned blocks (MVP → V1)
1. **AI Product Recommendations** (Recommendation Agent) — related/cross-sell/upsell, personalized; PDP + cart + collection.
2. **CRO Widgets** (CRO Agent) — trust badges, urgency/social-proof (only truthful, policy-safe), size guides, sticky add-to-cart — each merchant-configurable + honest (no dark patterns, `00` P1).
3. **A/B Experiment container** (CRO Agent) — renders variant per assignment; measures outcomes feeding MAVD (`29`). Assignment deterministic per visitor; no flicker (server/edge assignment where possible).
4. **Announcement / Promo bar** (Marketing Agent) — campaign-driven, scheduled.
5. **App embed: Storefront signal collector** — privacy-respecting event capture (page/product views, add-to-cart) for CRO/analytics, consent-aware (`44`).

## Architecture
- Extension under `extensions/theme-extension/` with `blocks/*.liquid`, `assets/*`, `snippets/*`, `locales/*`, `schema` settings.
- **Data:** blocks read config via the app proxy or embedded settings; dynamic data (recommendations) fetched from our **App Proxy** endpoint (authenticated, shop-scoped) or precomputed + cached to keep storefront fast.
- **App Proxy** (`/apps/trymerchantai/*` → our server) serves recommendation/experiment payloads with signed requests; verify proxy signature (`32`).
- **Server side:** Recommendation/CRO agents precompute payloads (jobs, `17`), cache in Redis/CDN; storefront fetches are cheap + cacheable.

## Performance (storefront is sacred) (`33`,`35`)
- Minimal JS, deferred/async, no render-blocking; lazy-load below-fold; respect Core Web Vitals (LCP/CLS/INP) — storefront speed affects SEO + conversion.
- No layout shift (reserve space); avoid experiment flicker; small bundle; CDN-cached assets.
- Fail open: if our endpoint is slow/down, the block renders nothing or a cached fallback — never blocks the page or breaks the theme.

## Accessibility (`34`)
- Blocks are keyboard-accessible, labelled, contrast-compliant, reduced-motion aware; injected content doesn't trap focus or break theme semantics.

## Merchant control & safety
- Everything is opt-in via theme editor; removing a block is instant + non-destructive.
- No hidden/deceptive content; claims (stock/social proof) must be truthful + data-backed (App Store + trust, `43`,`00`).
- Preview in theme editor before publish; publishing a theme is merchant-driven (Theme Agent treats theme publish as irreversible-class → guarded, `16`).

## Security (`32`)
- App Proxy signature verification; shop-scoped data only; no PII exposed to storefront JS beyond what's public; CSP-friendly; sanitize any dynamic content; rate-limit proxy endpoints.

## Analytics & outcomes (`29`)
- Storefront events (consented) → analytics pipeline → attribute experiment/recommendation impact to MAVD. Deterministic experiment assignment + exposure logging for valid measurement.

## Edge cases
- Theme without app-block support (vintage themes) → app embed fallback or graceful no-op + merchant guidance.
- Merchant customizes/removes block → respected; no re-injection.
- Endpoint latency/outage → cached/empty fallback, page unaffected.
- Consent withheld → no tracking, recommendations degrade to non-personalized (`44`).
- Multiple apps' blocks conflict → scoped styles, no global CSS leakage.

## Testing (`36`)
- Theme editor install/uninstall of blocks; render on multiple OS 2.0 themes; performance budget checks (Lighthouse/CWV); a11y audit; App Proxy signature tests; experiment assignment/exposure correctness; fail-open tests (endpoint down).

## Future expansion
Checkout UI extensions (Plus), post-purchase, bundle/discount via Functions (`22`), personalization models, and a block marketplace (`50`).

## Decisions (ADR)
- **ADR-023-1:** Storefront changes only via Theme App Extensions/App Blocks — never edit theme code.
- **ADR-023-2:** Storefront blocks fail open; our latency/outage must never degrade the merchant's storefront.
- **ADR-023-3:** No deceptive CRO patterns; all social-proof/urgency must be truthful + data-backed.

## Maintenance
Owned by Shopify SA + FE. New blocks: define settings schema, data source (precompute + cache), perf + a11y budget, fail-open behavior, tests. Re-verify on theme/OS updates.
