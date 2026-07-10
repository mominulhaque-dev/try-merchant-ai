# 10 — Information Architecture

## Purpose
Define the app's navigation, screen hierarchy, and route structure so the product is learnable, scalable to many agents/features, and consistent with Shopify Admin patterns.

## Goals
- A nav that scales from 4 agents to 12+ without becoming a junk drawer.
- Routes that map cleanly to React Router 7 file conventions (`21`).
- IA that respects Admin embedding + App Bridge navigation.

## Principles
- **One home, many facets.** Merchant lives on a dashboard; agents are lenses, not silos.
- **Task-first, not feature-first.** Nav reflects jobs (`08`), not internal architecture.
- **Progressive disclosure.** Advanced governance/settings tucked away; core loop up front.
- **Shopify-native nav.** Use App Bridge `NavMenu` for top-level sections; Polaris page/layout patterns within (`11`, `22`).

## Top-level navigation (App Bridge NavMenu)
1. **Home / Dashboard** — health score, top findings, recent actions, ROI snapshot (`14`).
2. **Copilot** — chat (`15`).
3. **Findings** — all recommendations, filterable by domain/severity.
4. **Agents** — the fleet; per-agent status, autonomy, activity (`16`).
5. **Automations** — triggers/workflows + run history (`17`).
6. **Reports** — ROI/MAVD, action history, exports (`30`).
7. **Settings** — plan/billing, autonomy governance, roles/seats, notifications, data & privacy.

> Keep top-level ≤7 to stay learnable. "Agents" is the scalable container for growth (adding agents doesn't add nav items).

## Screen hierarchy
```
Home (Dashboard)
├─ Health score + trend
├─ Top prioritized findings (→ Findings)
├─ Recent actions + undo (→ Reports/history)
├─ ROI snapshot (→ Reports)
└─ Copilot quick-entry

Copilot
├─ Chat thread(s)
├─ Suggested prompts / empty state
└─ Action cards (→ Action pipeline)

Findings
├─ Filters (domain, severity, effort, status)
├─ Finding list (grouped)
└─ Finding detail (what/why/impact/undo) → Action

Agents
├─ Agent grid (status, autonomy, last run, budget)
└─ Agent detail
   ├─ Responsibilities + scope
   ├─ Autonomy control (trust ladder)
   ├─ Activity log / recent actions
   ├─ Memory (what it knows) (→ 31)
   └─ Budget/usage (→ 27)

Automations
├─ Automation list (enabled/paused/error)
├─ Automation detail (trigger, autonomy, guardrails, kill-switch)
└─ Run history

Reports
├─ ROI/MAVD dashboard
├─ Action history (audit-backed)
└─ Exports

Settings
├─ Plan & Billing (→ 27)
├─ Autonomy & Governance (→ 26)
├─ Roles & Seats (→ 26)
├─ Notifications (→ 28)
├─ Data & Privacy / Export / Uninstall (→ 44)
└─ Integrations (future)
```

## Route map (React Router 7 — actual template)
Routes live under `app/routes/` using the file conventions of `@react-router/fs-routes`. Embedded routes sit under the authenticated `app.*` segment (mirrors current template's `app.tsx` layout).

| Route (file) | Screen | Notes |
|---|---|---|
| `app/routes/app.tsx` | Authenticated layout + NavMenu | exists (template) |
| `app/routes/app._index.tsx` | Home/Dashboard | replace template placeholder |
| `app/routes/app.copilot.tsx` | Copilot chat | streaming (`15`,`21`) |
| `app/routes/app.findings._index.tsx` | Findings list | filters via search params |
| `app/routes/app.findings.$id.tsx` | Finding detail | |
| `app/routes/app.agents._index.tsx` | Agent grid | |
| `app/routes/app.agents.$agent.tsx` | Agent detail | |
| `app/routes/app.automations._index.tsx` | Automations | |
| `app/routes/app.automations.$id.tsx` | Automation detail | |
| `app/routes/app.reports.tsx` | Reports/ROI | |
| `app/routes/app.settings.*.tsx` | Settings sub-pages | billing/governance/etc |
| `app/routes/auth.*` | OAuth | template-provided (`25`) |
| `app/routes/webhooks.*` | Webhook handlers | (`24`) |
| `app/routes/api.*` | Internal JSON/stream endpoints | (`19`) |

## URL & state conventions
- Filters/sort/pagination in **search params** (shareable, back-button safe).
- Resource detail via path param (`$id`).
- App Bridge handles embedded navigation; use App Bridge/React Router links, never full reloads.
- Deep links from notifications/emails land on the exact finding/action.

## Empty/first-run IA
Before first scan, Home shows an activation-focused layout (single CTA), not empty tables (`09`,`11`).

## Search & findability
- Global command/search (later) to jump to agents, findings, settings, actions.
- Findings + reports fully filterable; audit log searchable (`41`).

## Accessibility of IA
- Logical heading order, skip links, keyboard-navigable nav, focus management on route change (`34`).

## Scalability
- Adding an agent = a card in Agents + optional finding domains; **no new top-level nav**. This keeps IA stable as the fleet grows to 12+ and beyond (marketplace, `50`).

## Edge cases
- Merchant with no findings → celebratory "healthy store" state + monitoring reassurance, not blank.
- Plan-gated section → visible but locked with upsell context (`27`).
- Deep link to a gated/removed resource → graceful redirect + explanation.

## Testing
IA verified via nav e2e (every top-level reachable, back-button correct, deep links resolve), a11y nav audit (`36`,`34`).

## Maintenance
IA owned by UX+FE. New routes must fit this map + naming; keep top-level count disciplined. Sync route table with actual `app/routes/` in the same PR.
