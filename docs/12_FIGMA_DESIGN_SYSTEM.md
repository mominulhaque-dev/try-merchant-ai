# 12 — Figma Design System

## Purpose
Define how design is structured in Figma and how design tokens map to Polaris + code (`13`), so design and engineering stay in lock-step and screens are producible at enterprise scale.

## Goals
- A token architecture that mirrors Polaris and our brand layer (`05`).
- A Figma file/library structure that scales to 50+ screens and 12+ agents.
- A design→code contract (tokens, components, states) that prevents drift.

## Study inputs (benchmark before designing)
Design leads MUST study and distill patterns from: **Shopify Admin & Polaris** (native fidelity, tables, banners, resource pages), **Stripe** (billing clarity, data density), **Linear** (speed, keyboard, restraint), **Notion** (content blocks, empty states), **Cursor/Claude/OpenAI** (chat + streaming + tool-use UX), **Vercel** (dashboards, deploy/status states), **HubSpot/Klaviyo** (marketing/automation builders), **Framer** (motion, polish). Extract patterns, don't copy; everything reconciles to Polaris in-app.

## Figma file structure
```
📁 TryMerchantAI Design
├─ 00 · Foundations (tokens, color, type, spacing, grid, elevation, motion)
├─ 01 · Iconography (Polaris + custom agent glyphs)
├─ 02 · Components (mirrors 13_COMPONENT_LIBRARY)
│   └─ each with variants + all states (empty/loading/success/error/partial/disabled)
├─ 03 · Patterns (action pipeline, finding card, chat, autonomy control, upsell)
├─ 04 · Screens (by IA: Home, Copilot, Findings, Agents, Automations, Reports, Settings)
│   └─ each screen × states × responsive (desktop/mobile) + dark mode
├─ 05 · Flows / Prototypes (matches 09_USER_FLOW)
├─ 06 · Marketing (site, App Store listing assets — 43)
└─ 07 · Archive
```
- Publish **02 Components** and **00 Foundations** as a Figma **team library**; screens consume the library only (no detached styles).
- Branching for major redesigns; changes reviewed before publish.

## Token architecture
Three layers, one direction of dependency (brand → semantic → component), aligned to Polaris:

1. **Primitive tokens** — raw values (color ramps, spacing scale, radii, type sizes). Brand primitives from `05`.
2. **Semantic tokens** — map to Polaris semantics: `color/surface`, `color/text`, `color/border`, `color/icon`, `color/interactive`, `color/critical|warning|success|info`, plus our `color/ai-accent`. Spacing `space/025…800`, radius, elevation, motion durations/easings.
3. **Component tokens** — per-component references to semantic tokens (`button/primary/bg` → `color/interactive`).

**Rule:** in-app semantic tokens MUST resolve to Polaris CSS custom properties (`--p-color-*`, `--p-space-*`) in code (`13`). Figma tokens and code tokens share names so a designer's `color/critical` == engineer's `--p-color-text-critical`. Export via Figma variables → tokens JSON → build step.

## Color (see `05`,`34`)
- In-app: Polaris token set + `ai-accent` (indigo→violet, used sparingly on AI content).
- Every text/bg pair validated ≥ AA in Figma (contrast plugin) before publish.
- Dark mode + merchant themes represented as Figma variable modes; every screen shown in light + dark.

## Typography
- Mirror Polaris type scale (display/heading/body/caption) as Figma text styles; marketing uses the `05` marketing stack. Never more styles than the scale defines.

## Spacing, grid, layout
- 4px base; spacing scale `025=2, 050=4, 100=8, 200=16 …` matching Polaris `--p-space-*`.
- Admin content grid: Polaris `Page`/`Layout` columns; responsive breakpoints matching Admin.

## Iconography
- Polaris icon set as a Figma library; custom agent glyphs drawn to Polaris stroke weight, 20/16px grids; each agent has one canonical glyph reused everywhere (`13`,`16`).

## Component coverage (each in Figma with ALL states)
Buttons, inputs/selects, banners, toasts, modals, cards, `IndexTable`, badges, tabs, tooltips, popovers, skeletons, spinners, empty-state, avatars/agent-status, chat bubble + streaming + tool-call card, finding card, action-preview (diff) card, autonomy control, ROI stat cards, charts, upsell/paywall, settings rows. Full contract in `13`.

## States matrix (non-negotiable)
Every component + screen designed for: **default, hover, focus, active, disabled, empty, loading (skeleton), success, error, partial, dark mode, mobile.** Missing states block publish.

## Animation specs
Document duration/easing/trigger per interaction (thinking, stream, execute, undo, toast) with reduced-motion fallbacks (`11`,`34`). Prototype in **05 Flows**.

## Handoff & design→code contract
- Dev-ready screens tagged; specs auto-derived from tokens (spacing/color/type read from variables, not eyeballed).
- Each component links to its `13` entry + Polaris source; deviations documented.
- Redlines only for custom (non-Polaris) components.
- Definition of design-done: all states present, tokens (no raw values), a11y annotations (focus order, labels, contrast), responsive + dark verified.

## Accessibility in Figma
Annotate focus order, ARIA roles/labels, min target sizes (24px+), contrast checks, and content structure per `34`.

## Edge cases
- Long content / localization / RTL frames for critical screens.
- Extreme data (0 findings, 10k findings) mockups.
- Offline/degraded AI state mockups.

## Testing / QA
Design QA checklist per screen; visual-regression baseline images exported for `36`. Library changes reviewed + versioned.

## Future expansion
Marketplace agent-card templates, white-label theming variables, and a public-benchmark visual kit (`50`).

## Maintenance
Owned by Design. Token/library changes ship with the matching `13` code PR. Re-audit against Polaris each major release; keep Figma variables the SSOT for design values.
