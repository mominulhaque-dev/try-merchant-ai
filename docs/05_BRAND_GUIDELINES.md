# 05 — Brand Guidelines

## Purpose
Define TryMerchantAI's brand identity so every surface — app, marketing site, App Store listing, docs — feels like one trustworthy, intelligent product. Brand must reconcile two feelings: **cutting-edge AI** and **safe, enterprise-grade trust**. Inside Shopify Admin, the brand also MUST defer to Polaris (`11`) — we express personality within Shopify's frame, never fighting it.

## Goals
- A consistent verbal + visual identity.
- Tokens that map 1:1 to the design system (`12`) and component library (`13`).
- App-Store-safe, accessibility-first color and type.

## Brand essence
- **Positioning:** The AI Commerce Operating System.
- **Personality:** Competent, calm, proactive, transparent. A brilliant operator who explains their reasoning and never overreaches. Think "senior operator + trusted advisor," not "hype AI."
- **Promise:** "We run the busywork and prove the results — you stay in control."

## Voice & tone
| Trait | Do | Don't |
|---|---|---|
| Clear | Plain language, short sentences, define jargon | Buzzword salad, "revolutionary AI" hype |
| Confident, not cocky | "Here's what I recommend and why." | "Trust me," vague promises |
| Transparent | Always state impact + how to undo | Hide what the agent did |
| Respectful of control | "With your approval…" | Act first, ask later |
| Outcome-oriented | Talk in metrics + dollars | Talk in features |

**Tone shifts by context:** Confident+concise in recommendations; careful+explicit before executing a mutation; warm+plain in support; precise+neutral in errors (`40`). Never blame the merchant.

**Naming:** Product is **TryMerchantAI** (one word, camel-case "AI"). Agents are named by function ("SEO Agent," "Store Health Agent"). The chat copilot is **"Copilot"** (or a named persona TBD — keep it professional, not a gimmick mascot).

## Logo
- **Primary:** wordmark "TryMerchantAI" + a geometric mark suggesting orchestration/nodes (an operator coordinating agents). Deliver as SVG (scalable, crisp in Admin).
- **Clear space:** ≥ the height of the "M" on all sides.
- **Min size:** 24px mark height in-app; 120px wordmark on web.
- **Variants:** full-color, monochrome (light/dark), mark-only (favicon/app icon).
- **App Store icon:** square, high-contrast mark on brand background, legible at 48px. Follows Shopify listing icon specs (`43`).
- **Misuse:** don't stretch, recolor outside palette, add shadows/gradients not in the system, or place low-contrast on busy backgrounds.

## Color system
Two-layer: **brand palette** (marketing, logo, accents) and **in-app palette** (must align with Polaris tokens so we inherit Shopify's contrast + dark-mode work).

### Brand palette (marketing site, listing)
- **Primary — "Operator Indigo":** deep indigo/blue (trust + intelligence). e.g. `#3E5BFF` family.
- **Accent — "Signal Green":** success/ROI/positive outcomes. e.g. `#1FA971` family.
- **Alert — "Amber"** and **"Critical Red"** for warnings/errors.
- **Neutrals:** ink, slate, cloud, white for text/surfaces.
- **AI accent — subtle gradient** (indigo→violet) reserved *only* for AI-generated/agent surfaces, used sparingly to signal "this is AI."

All pairings MUST meet **WCAG 2.2 AA** contrast (≥4.5:1 body text, ≥3:1 large text/UI). See `34`.

### In-app palette
Inside Admin, use **Polaris color tokens** (`--p-color-*`) as the source of truth so the app respects merchant theme/dark mode. Brand accents appear only where Polaris allows custom accents (AI surfaces, our logo, empty-state illustrations). Never hard-code hex where a Polaris token exists (`11`, `13`).

Semantic mapping: success→ROI/positive, warning→needs-attention, critical→destructive/irreversible, info→neutral insight, **ai/accent→agent-generated content**.

## Typography
- **In-app:** inherit Polaris/`Inter` system stack — do not override Admin typography.
- **Marketing:** a clean geometric/grotesque sans (e.g., Inter / General Sans) for headings + body; monospace (e.g., JetBrains Mono) for data, code, metrics.
- **Scale:** map to a modular type scale mirrored in `12`. Never use more than 2 families on web.
- **Accessibility:** min 14px body web / respect Polaris in-app; line-height ≥1.5; never convey meaning by color alone.

## Iconography
- In-app: **Polaris icons** first. Custom icons only for concepts Polaris lacks (agents, orchestration) and must match Polaris stroke/weight.
- Each agent has a distinct, simple glyph (SEO magnifier, CRO funnel, Inventory box, etc.) — see `13`.

## Imagery & illustration
- Minimal, geometric, "operator dashboard" aesthetic. Avoid clichéd robot/brain imagery.
- Illustrations for empty/loading/success states (`11`) share a consistent line-weight and palette.
- Real data-viz over decorative stock.

## Motion
- Purposeful, quick (150–250ms), respect `prefers-reduced-motion` (`34`). Motion signals state (agent thinking, action executed, undo available), never decoration. Details in `11`.

## AI transparency cues (brand-critical)
Because we act on the merchant's store, the brand includes **trust signifiers** everywhere AI acts:
- A consistent **"AI" badge / accent** on agent-generated content.
- An **"undo"** affordance visually tied to any executed action.
- A subtle **agent avatar/status** ("Store Health Agent · analyzing…").
These are brand elements *and* product-safety elements (`00` P1/P3).

## Do / Don't summary
- ✅ Look native in Admin; add personality only on AI + brand surfaces.
- ✅ Lead with outcomes and transparency.
- ❌ No hype, no dark patterns, no low-contrast, no Polaris overrides.

## Edge cases
- Dark mode: rely on Polaris tokens; test brand accents in both themes.
- Localization: wordmark stays Latin; ensure layouts handle RTL + long strings (`34`, `50`).

## Future expansion
Brand extends to agent marketplace (co-branding rules), enterprise (white-label considerations), and a public benchmark-report visual identity.

## Maintenance
Owned by Brand/Design. Token changes sync to `12`/`13` in the same PR. Any new color/type MUST pass contrast checks before merge.
