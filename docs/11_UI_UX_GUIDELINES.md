# 11 — UI/UX Guidelines

## Purpose
Define how TryMerchantAI looks and behaves inside Shopify Admin so it feels native, trustworthy, accessible, and unmistakably ours where it matters (AI surfaces). These rules bind design (`12`), components (`13`), and every screen.

## Goals
- Native Polaris fidelity + a restrained AI identity layer.
- Consistent state handling (empty/loading/success/error/partial) everywhere.
- WCAG 2.2 AA and performance baked into interaction design.

## Foundational rules
1. **Polaris is the substrate.** Use Polaris components, layout primitives, and tokens for structure, spacing, color, and type. Do not hand-roll what Polaris provides (`22`,`13`).
2. **App Bridge for chrome.** Title bar, nav menu, toasts, modals, resource pickers, and save bar via App Bridge — not custom equivalents.
3. **Brand only where allowed.** Personality (indigo/AI-accent, agent glyphs, illustrations) appears on AI content, empty states, and our logo — never by overriding Admin chrome (`05`).
4. **Trust is a UI requirement.** Every agent action shows what/why/impact/undo. This is design law, not copy garnish (`00` P1/P3).

## Layout & spacing
- Use Polaris `Page`, `Layout`, `Card`/`BlockStack`/`InlineStack`, `Box` with token spacing (`--p-space-*`). No magic pixel margins.
- Responsive: Admin renders on desktop + mobile app; layouts MUST reflow (single column on narrow). Test in Shopify mobile.
- Density: comfortable default; tables use Polaris `IndexTable` with sane column priorities.

## Interaction states (mandatory for every view)
- **Empty:** purpose + single primary action + light illustration. Never a blank card. First-run empties are activation moments (`09`).
- **Loading:** Polaris `SkeletonPage`/`Spinner`; show *what* is loading (e.g., per-dimension scan progress). Optimistic UI where safe.
- **Success:** confirm via toast + inline state change + undo affordance for mutations.
- **Error:** plain-language cause + retry + support path; never raw stack traces; preserve user input (`40`).
- **Partial:** show what succeeded + what failed + targeted retry (bulk/multi-item).
- **Degraded (AI):** banner + Suggest-only mode when providers fail (`40`).

## AI-specific UX patterns
- **AI provenance badge:** any AI-generated text/action carries a consistent "AI" marker + agent name/status.
- **Reasoning transparency:** show tool/agent activity ("Reading products… drafting SEO titles…"); expandable "why this recommendation."
- **Preview before write:** before/after diff for every mutation; irreversible actions get a distinct confirm treatment.
- **Undo affordance:** visually tied to the executed action; time-boxed where relevant; always discoverable in Reports history.
- **Streaming:** chat streams tokens; show typing/thinking state; allow stop-generation.
- **Autonomy control surfaced:** trust-ladder level shown wherever an agent can act; changing it is explicit + explained (`00` P2).
- **Confidence + impact:** recommendations show estimated impact + confidence; never present a guess as certainty.

## Copy & microcopy (with `05` voice)
- Verbs over nouns for actions ("Fix SEO title", not "SEO title optimization").
- State impact + reversibility inline ("Adds alt text to 12 images · reversible").
- Errors: what happened, why (plain), what to do next. Never blame the merchant.
- Numbers: format currency/locale-aware; show "as of" timestamps for data freshness.

## Forms & inputs
- Polaris form components; inline validation; disable submit while invalid; preserve input on error.
- Dangerous fields (bulk scope, autonomy) require explicit confirmation + clear consequences.
- Autosave settings where safe; explicit save (App Bridge SaveBar) where a batch commit is clearer.

## Tables & data
- `IndexTable` with sorting/filtering via URL search params (`10`); pagination or infinite scroll with clear counts; bulk actions with selection + progress + partial results.
- Empty filtered results → "no matches, adjust filters," not the first-run empty.

## Feedback & notifications
- Transient success → toast; persistent/important → banner or Reports entry; cross-session → notifications (`28`). Avoid toast spam; batch bulk results.

## Motion (with `05`)
- 150–250ms, ease-out; signals state changes (thinking, executed, undo available). Respect `prefers-reduced-motion` → replace motion with instant state (`34`). No purely decorative animation.

## Accessibility (summary; full spec `34`)
- Keyboard-operable everything; visible focus; correct roles/labels/ARIA via Polaris; contrast AA; no color-only meaning; live regions announce streaming/async results; focus management on route/modal changes.

## Performance-aware UX (`33`)
- Skeletons over spinners for perceived speed; defer/lazy-load non-critical; stream long results; paginate/virtualize large lists; avoid layout shift.

## Do / Don't
- ✅ Look native, explain AI, show undo, handle every state.
- ❌ Override Admin chrome, hide what AI did, leave blank/dead states, use color-only signals, block the UI on long jobs.

## Edge cases
- Dark mode / merchant theme → rely on Polaris tokens; verify AI accents in both.
- Long strings / localization / RTL → flexible layouts, no truncation of critical info (`34`,`50`).
- Very large result sets → virtualize + summarize.
- Slow network / Admin iframe constraints → progressive loading, background jobs + notify.

## Testing
Visual regression on key screens; a11y automated + manual (`34`,`36`); state-matrix tests (each view × each state); interaction tests for preview→approve→execute→undo.

## Maintenance
Owned by Design+FE. Guidelines evolve with Polaris releases; re-audit on each Polaris major. Deviations require design review + rationale logged.
