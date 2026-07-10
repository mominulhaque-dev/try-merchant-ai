# 14 — Dashboard Specification

## Purpose
Specify the Home/Dashboard (`app/routes/app._index.tsx`) — the merchant's daily surface. It must communicate store health, surface the highest-value next actions, show ROI, and route into the core loop, all within performance + a11y budgets.

## Goals
- Answer three questions in <5 seconds: *Is my store healthy? What should I do next? Is this app paying off?*
- Zero dead ends; always a clear primary action.
- Load fast (skeletons, streamed/deferred data) within `33` budget.

## Layout (Polaris `Page` + `Layout`)
Top → bottom, responsive (2-col desktop → 1-col mobile):

1. **Header bar** — greeting, store name, "Run scan" (secondary), Copilot quick-entry (primary), last-scan "as of" timestamp.
2. **HealthScore card** (`13`) — overall score + trend + domain breakdown; click → Findings filtered by domain.
3. **Top Findings** — 3–5 highest `impact×confidence/effort` findings as `FindingCard`s with inline "Fix it"; "View all" → Findings.
4. **ROI / MAVD snapshot** — `RoiStat`s: value delivered (period), actions executed, hours saved, with "as of" + confidence; click → Reports.
5. **Recent Actions** — last executed actions with status + **undo**; click → Reports history.
6. **Agents strip** — compact agent status row (running/idle/needs-attention); click → Agents.
7. **Automations summary** (V1) — active automations + last run; errors surfaced.
8. **Setup/next-best-action nudge** — contextual (enable an agent, raise autonomy, connect email) based on profile (`08`).

## First-run vs steady-state
- **First-run (no scan yet):** replace tables with a single activation card — value line + "Run your first Store Health scan" (`09` Flow 1). No empty tables.
- **Healthy store (no findings):** celebratory "healthy" state + "we're monitoring" reassurance + trend, not a blank.
- **Steady-state:** full layout above.

## Data loading (React Router 7)
- Route `loader` returns critical above-the-fold data (health score, top findings) fast; **defer** heavier ROI/history via streaming (`21`).
- Cache last scan snapshot; show "as of" + background refresh; never block render on a live scan.
- All Shopify reads server-side via authenticated loader (`22`,`25`).

## States (per view section)
- Loading → `SkeletonPage` + section skeletons.
- Error (section-level) → inline banner + retry; one failing section never blanks the page (`40`).
- Degraded AI → `DegradedBanner`; findings/ROI from cache with staleness note.
- Empty per section handled individually (no findings, no ROI yet, no actions yet).

## Interactions
- "Fix it" → `ActionPreview` pipeline (`13`,`09` Flow 4) inline (modal/drawer), returns to dashboard with updated state + undo.
- "Run scan" → background job (`17`), progress indicator, notify on completion (`28`); dashboard stays usable.
- Undo on recent action → reverses + toast + audit note.
- All navigation via App Bridge/RR links (embedded, no full reload).

## Metrics shown (definitions)
- **Health score:** weighted composite of domain sub-scores (SEO/CRO/content/catalog/perf/inventory), 0–100, with trend vs last scan.
- **MAVD (period):** attributed value from executed actions (`01`,`30`); show confidence + "as of."
- **Actions executed / hours saved:** counts from audit log (`41`) × labor-rate assumption (documented).

## Personalization
Dashboard composition adapts to plan (gated sections show `UpsellCard`), profile (agency → multi-store teaser future), and maturity (new store → setup emphasis).

## Accessibility (`34`)
Logical heading order (h1 page → h2 sections); each card keyboard-reachable; live region announces scan completion; charts have text/table alternatives; focus returns correctly after modal actions.

## Performance (`33`)
- Above-the-fold LCP element = health score card; keep critical loader lean.
- Defer/stream ROI + history; skeletons prevent layout shift; virtualize long recent-actions.
- Cache-first with background revalidation; avoid N+1 Shopify calls (batch/bulk `22`).

## Edge cases
- Huge catalog → dashboard reads from cached scan aggregates, not live full-catalog queries.
- Brand-new store → setup-focused, no scary "0 score."
- Scope revoked → affected sections show re-authorize prompt, rest of dashboard works (`26`).
- Plan cap reached → banner + gated actions clearly marked (`27`).
- Multiple tabs / stale data → "as of" timestamps + revalidate on focus.

## Telemetry (`29`)
Dashboard view, section impressions, "Fix it"/undo/run-scan clicks, activation funnel position, upsell impressions/clicks. Feeds funnel + MAVD.

## Testing (`36`)
State-matrix (first-run/steady/healthy/error/degraded), loader/defer behavior, a11y audit, visual regression (light/dark/mobile), interaction e2e for fix-it + undo + run-scan.

## Future expansion
Customizable widgets, multi-store rollup (agency), goal-tracking ("grow repeat rate to X"), and predictive alerts (`50`).

## Maintenance
Owned by PM+FE. Any new section must define its states, loader strategy, a11y, and telemetry here before build. Keep in sync with `app/routes/app._index.tsx`.
