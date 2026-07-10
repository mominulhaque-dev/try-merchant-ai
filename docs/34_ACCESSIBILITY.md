# 34 — Accessibility

## Purpose
Define accessibility standards so TryMerchantAI is usable by everyone and meets Shopify's accessibility expectations (`43`). Target: **WCAG 2.2 Level AA** across embedded app + storefront extensions + emails.

## Goals
- WCAG 2.2 AA conformance, verified automatically + manually.
- Accessibility built into components (`13`) + design (`12`), not bolted on.
- Accessible AI patterns (streaming, live results, previews).

## Standard & scope
- **WCAG 2.2 AA** for: embedded Admin app, Theme App Extension storefront blocks (`23`), transactional emails (`28`), marketing site.
- Leverage **Polaris** (accessible by default) — but custom components (`13`) MUST meet the same bar.

## Core requirements (POUR)
**Perceivable**
- Text alternatives for non-text (icons labelled, charts have text/table summaries `30`).
- Contrast ≥ 4.5:1 (text), ≥ 3:1 (large text + UI/graphics) — verified in Figma + CI (`12`,`05`).
- Never convey meaning by color alone (severity/status = icon + text + color).
- Responsive/zoom to 200%+ without loss; reflow at 320px; no horizontal scroll traps.

**Operable**
- Full keyboard operability; logical tab order; visible focus indicators; no keyboard traps.
- Focus management: move focus to new content on route/modal open; return focus on close.
- Target size ≥ 24×24px (WCAG 2.2); adequate spacing.
- No content flashing > 3x/sec; `prefers-reduced-motion` respected (motion → instant state, `11`).
- Skip-to-content link; accessible nav.

**Understandable**
- Clear labels + instructions; inline, programmatically-associated error messages; input purpose identified.
- Consistent navigation + component behavior; predictable (no surprise context changes).
- Plain language (`05`); define jargon.

**Robust**
- Valid semantic HTML; correct ARIA roles/states (prefer native elements); works with screen readers (VoiceOver, NVDA, JAWS) + assistive tech.
- Status messages via `aria-live` (async results, toasts, streaming).

## AI-specific accessibility patterns
- **Streaming chat (`15`):** assistant output in an `aria-live="polite"` log region; announce completion; stop-generation button keyboard-reachable + labelled; don't spam SR with every token (announce in sensible chunks).
- **Tool/agent activity:** status ("analyzing…") announced without overwhelming.
- **Action preview/diff (`13`):** before/after readable by SR (labelled regions); irreversible confirmation clearly announced (`aria-describedby`).
- **Findings/recommendations:** severity + impact conveyed textually, not color-only.
- **Charts/ROI (`30`):** every chart has an accessible summary + data-table alternative.

## Forms & interaction
- Every input labelled (visible label preferred); required + format communicated; errors associated + focus moved to first error; preserve input on error (`11`,`40`); autocomplete attributes.

## Storefront blocks (`23`)
- Injected content keyboard-accessible, labelled, contrast-compliant, doesn't trap focus or break theme landmarks; reduced-motion aware.

## Emails (`28`)
- Semantic structure, sufficient contrast, alt text on images, plain-text alternative, meaningful link text.

## Internationalization ties (`50`)
- Support long strings without clipping meaning; RTL layouts (logical CSS properties); locale-aware formatting; `lang` attributes set.

## Tooling & process
- **Automated:** `eslint-plugin-jsx-a11y` (already in devDeps), axe-core in tests + CI, Lighthouse a11y, contrast checks in design (`12`).
- **Manual:** keyboard-only pass, screen-reader pass on key flows (onboarding, fix-it+undo, chat, billing), zoom/reflow check each release.
- **Design annotations (`12`):** focus order, roles/labels, contrast, target size annotated before build.

## Acceptance (per feature, DoD `00`)
- [ ] Keyboard-operable, visible focus, correct focus management.
- [ ] Labels/roles/ARIA correct; SR-tested on critical flows.
- [ ] Contrast AA; no color-only meaning.
- [ ] Reduced-motion honored; targets ≥24px; reflow to 320px.
- [ ] axe/lint a11y checks pass in CI.

## Edge cases
- Dynamic/streamed content → live regions, not silent DOM changes.
- Long/complex tables → proper headers, captions, sortable-by-keyboard.
- Modals/drawers → focus trap *within* while open, restore on close.
- Data-viz-heavy screens → always a non-visual alternative.
- Localization/RTL → verify focus order + contrast per locale.

## Testing (`36`)
- CI: jsx-a11y + axe on component + route tests; Lighthouse a11y budget; contrast tests. Manual keyboard + SR checklist per release on critical flows. A11y failures block merge on covered paths.

## Future expansion
Accessibility statement (public), VPAT for enterprise, user testing with assistive-tech users, and AI-generated content a11y checks (e.g., ensure generated alt text is meaningful) (`50`).

## Decisions (ADR)
- **ADR-034-1:** WCAG 2.2 AA is the conformance target across all surfaces; a11y checks are CI-gated.
- **ADR-034-2:** Every chart/visual has a text/table alternative; status/severity never color-only.
- **ADR-034-3:** Streaming AI output uses polite live regions announced in chunks, with keyboard-reachable stop.

## Maintenance
Owned by Design + FE. New components ship with a11y built-in + tests. Re-audit each Polaris upgrade + release. Keep annotations in Figma synced with `12`/`13`.
