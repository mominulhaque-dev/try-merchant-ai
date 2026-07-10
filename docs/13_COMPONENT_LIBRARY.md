# 13 — Component Library

## Purpose
Define the React component library: what we build, what we inherit from Polaris, each component's contract (props, states, a11y, tokens), and the rules that keep UI consistent and maintainable.

## Goals
- Maximize reuse of `@shopify/polaris`; build custom only for concepts Polaris lacks (AI/agents).
- Every component: typed props, all states, a11y, token-driven styling, tested.
- One canonical implementation per pattern; no divergent copies.

## Principles
1. **Polaris-first.** If Polaris has it, use it. Wrap (not fork) when we need app-specific defaults.
2. **Composition over configuration.** Small primitives compose into patterns.
3. **Tokens only.** Styling references Polaris CSS custom properties / design tokens (`12`) — no hard-coded values.
4. **Typed contracts.** Strict TS props; discriminated unions for state-bearing components.
5. **Accessible by construction.** A11y is in the component, not the caller (`34`).

## Layer model
```
Polaris primitives (Button, Card, IndexTable, Banner, Modal, TextField, …)
        ▲ inherit/wrap
App wrappers (AppButton defaults, PageShell, FormRow) — thin
        ▲ compose
App components (custom, AI/domain) — FindingCard, ActionPreview, ChatMessage, AgentCard, AutonomyControl, RoiStat…
        ▲ compose
Screen components (route-level, in app/routes/**) — DashboardHome, CopilotView…
```
Custom components live in `app/components/**`, grouped by domain (`ui/`, `chat/`, `agents/`, `findings/`, `automations/`, `reports/`). Screen composition stays in route modules (`21`).

## Inherited from Polaris (use directly)
Layout: `Page, Layout, Card, BlockStack, InlineStack, Box, Divider, Grid`. Actions: `Button, ButtonGroup`. Data: `IndexTable, DataTable, ResourceList, Pagination, Badge, Tag`. Feedback: `Banner, Toast (via App Bridge), Spinner, SkeletonPage/BodyText`. Forms: `Form, TextField, Select, Checkbox, RadioButton, RangeSlider, DropZone`. Overlay: `Modal (App Bridge), Popover, Tooltip`. Nav: App Bridge `NavMenu, TitleBar, SaveBar`. Do not re-implement these.

## Custom component catalog (contracts)

Each entry: **Purpose · Key props · States · A11y · Tokens · Tests.**

### `AiProvenanceBadge`
- Purpose: mark AI-generated content/actions with agent identity.
- Props: `agent: AgentId`, `confidence?: number`, `tone?: 'ai'`.
- States: default; with-confidence.
- A11y: text label + icon (not color-only); `aria-label` names the agent.
- Tokens: `color/ai-accent`.
- Tests: renders agent name; a11y label present.

### `AgentCard`
- Purpose: represent an agent in the grid (`10` Agents).
- Props: `agent`, `status: 'idle'|'running'|'error'|'paused'`, `autonomyLevel`, `lastRun?`, `usage?`, `onOpen`.
- States: idle/running(activity pulse)/error(banner tone)/paused/locked(plan-gated).
- A11y: card is a labelled link/button; status conveyed by text+icon; live region when running.
- Tokens: Polaris surface/border + agent glyph.
- Tests: each status renders; locked shows upsell; keyboard-activatable.

### `AutonomyControl`
- Purpose: set trust-ladder level for an agent/automation (`00` P2).
- Props: `level: 'suggest'|'draft'|'approve'|'auto_reversible'|'auto_guarded'`, `allowed: level[]`, `onChange`, `explain: string`.
- States: default; changing (requires confirm for escalations); disabled(plan-gated).
- A11y: radio/segmented with clear labels + description of consequences; escalation confirm is focus-trapped.
- Tests: escalation requires explicit confirm; cannot exceed `allowed`.

### `FindingCard`
- Purpose: show one recommendation (`07` F-01/02).
- Props: `finding` (severity, domain, title, why, estImpact, effort, confidence, action), `onFix`, `onDismiss`, `onSnooze`.
- States: default/selected(bulk)/executing/done(with undo)/dismissed/failed.
- A11y: severity as badge+text; actions are buttons with descriptive labels.
- Tests: maps to a typed action; dismiss captures reason; states render.

### `ActionPreview` (diff card)
- Purpose: before/after preview + reversibility label before execution (`09` Flow 4).
- Props: `diff` (fields before/after), `reversible: boolean`, `scopeOk: boolean`, `onApprove`, `onCancel`, `itemCount?`.
- States: preview/approving/executing/success(undo)/failure(retry)/partial(per-item)/stale(re-preview).
- A11y: diff readable by SR (labelled before/after); irreversible gets distinct confirm + `aria-describedby` warning.
- Tests: irreversible requires confirm; stale triggers re-preview; partial shows per-item status.

### `ChatMessage` + `ChatComposer` + `ToolCallCard`
- Purpose: Copilot chat (`15`).
- `ChatMessage` props: `role: 'user'|'assistant'|'system'`, `content`, `streaming?`, `citations?`, `actions?`.
- `ToolCallCard` props: `tool`, `status: 'pending'|'running'|'done'|'error'`, `summary`.
- States: streaming(typing), tool-running, action-offered, error/degraded.
- A11y: messages in a log with `aria-live=polite` for streamed assistant output; stop-generation button; composer labelled, Enter/Shift-Enter semantics.
- Tests: streaming updates announced; action cards follow ActionPreview; stop works.

### `RoiStat` / `MetricCard`
- Purpose: ROI/MAVD + KPI display (`14`,`30`).
- Props: `label`, `value`, `delta?`, `confidence?`, `asOf`, `trend?`.
- States: default/loading(skeleton)/no-data(range or empty)/negative-delta.
- A11y: value + delta as text; trend chart has text alternative.
- Tests: locale/currency formatting; no-data state.

### `HealthScore`
- Purpose: overall store health gauge (`14`).
- Props: `score`, `trend`, `breakdownByDomain`.
- A11y: numeric + labelled; not color-only.

### `EmptyState` (app wrapper over Polaris)
- Purpose: consistent first-run/empty screens (`11`).
- Props: `heading`, `body`, `primaryAction`, `illustration?`, `variant: 'first-run'|'no-results'|'healthy'|'error'`.
- Tests: always has a next action.

### `UpsellCard` / `PaywallGate`
- Purpose: plan-gated feature messaging (`27`).
- Props: `feature`, `requiredPlan`, `valueFraming` (MAVD), `onUpgrade`.
- A11y: clearly labelled locked control + reason.

### `DegradedBanner`
- Purpose: AI-provider outage / Suggest-only mode (`40`).
- Props: `reason`, `mode: 'suggest-only'`.

## Component standards
- **Props:** strict TS; no `any`; discriminated unions for states; required a11y labels typed.
- **Styling:** Polaris tokens only; no inline hex/px where a token exists.
- **State:** presentational components are pure; data via loaders/actions (`21`) or hooks; no fetch inside dumb components.
- **Error boundaries:** route-level (`40`); components render fallback for null data.
- **Naming:** `PascalCase` files match export; one component per file + colocated test + stories/fixtures.
- **Docs:** each component has usage notes + a Figma link (`12`).

## Testing (per `36`)
- Unit: render each state; a11y assertions (roles/labels); prop contracts.
- Visual regression: snapshot each state (light/dark/mobile).
- Interaction: preview→approve→execute→undo path; chat streaming; autonomy escalation confirm.

## Edge cases
- Missing/partial data → safe fallbacks, never crash.
- Extreme values (huge numbers, long labels) → truncation with tooltip, never clip critical info.
- RTL/localization → logical-direction styles (`34`,`50`).

## Maintenance
Owned by FE. New patterns require a component here (no ad-hoc UI in routes). Polaris upgrades → re-verify wrappers. Keep this catalog synced with `app/components/**` and Figma `02 Components`.
