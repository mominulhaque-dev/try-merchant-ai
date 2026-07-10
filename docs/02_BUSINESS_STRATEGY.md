# 02 — Business Strategy

## Purpose
Define how TryMerchantAI acquires, monetizes, and retains merchants, and how it builds a durable moat. Covers GTM, pricing, unit economics, and defensibility.

## Goals
- A pricing model that (a) passes Shopify Billing API constraints, (b) aligns price to value (MAVD), and (c) yields healthy gross margin despite AI COGS.
- A GTM motion that compounds (marketplace + content + partnerships), not just paid.
- Unit economics that support venture-scale growth.

## Business model
B2B SaaS distributed through the **Shopify App Store**, billed via Shopify's **Billing API** (managed pricing / app subscriptions + usage charges). Revenue share to Shopify applies per current terms (0% below the annual revenue threshold, then 15%; keep this assumption versioned as Shopify updates it).

## Pricing strategy

### Model: hybrid seat-light + usage-metered plan tiers
AI COGS scale with usage, so pure flat-rate is dangerous and pure usage-based is scary to SMBs. We use **tiered plans with generous included "AI action" allotments + metered overage**, so predictability for the merchant and margin protection for us.

Unit of metering: the **AI Action Credit (AAC)** — one credit ≈ one agent task that produces a recommendation or executes a mutation (chat turns are cheaper micro-credits). Credits abstract away token accounting so pricing is legible.

| Plan | Target | Price (USD/mo) | Included AACs | Agents unlocked | Autonomy |
|---|---|---|---|---|---|
| **Free / Starter** | Trial, micro | $0 | Low (e.g. 50) | Store Health + Copilot (Suggest) | Suggest only |
| **Growth** | Solo → small | $49 | Medium (e.g. 1,500) | + SEO, CRO, Content, Analytics | Up to Approve-to-execute |
| **Pro** | Scaling brand | $149 | High (e.g. 6,000) | + Email, Marketing, Inventory, Support, Recommendation | Up to Auto-execute (reversible) |
| **Scale / Plus** | Plus & multi-store | $499+ | Very high + pooled | All + Theme + Workflow + admin extensions, seats | Guarded autonomy, custom policy |
| **Enterprise** | Large brands | Custom | Custom / committed | All + SSO, SLA, dedicated support | Custom governance |

Overage: metered AAC packs (e.g., $X per 1,000) billed via Shopify usage charges with a **hard cap** the merchant sets (never bill-shock; `27`).

Design constraints enforced by Shopify Billing (`27_SUBSCRIPTION_BILLING.md`): all charges via Billing API, clear trial, capped usage charges, test charges in dev.

### Pricing principles
- Price to **proven value (MAVD)**, not to cost. Show ROI in-app so the plan pays for itself.
- Free tier is a **product-qualified-lead engine**, not charity — it must reliably surface a paywalled "aha."
- No dark patterns. Downgrades and cancellation are one click (App Store requirement + `00` P1).

## Go-to-market

### Motion 1 — App Store SEO + listing conversion (primary, compounding)
Rank for high-intent terms (SEO app, CRO, store optimization, AI assistant). Invest in listing quality, screenshots, video, and reviews. See `35_SEO.md`, `43`.

### Motion 2 — Content + education (compounding)
"AI ecommerce operations" playbooks, teardowns, benchmark reports built from our aggregated (anonymized, consented) outcome data — a data flywheel that also markets the product.

### Motion 3 — Partnerships
Shopify agencies/Partners (referral + revenue share), theme vendors, and complementary apps. Agencies manage many stores → high-LTV multi-store accounts.

### Motion 4 — Product-led virality
Shareable store-health scorecards, public "before/after" outcome cards (opt-in), and an eventual agent marketplace.

### Motion 5 — Targeted outbound for Plus/Enterprise
Direct sales to larger brands once autonomy + governance features are proven.

## Unit economics (target model)
- **Gross margin:** ≥75% at scale. AI COGS held to ≤15% of revenue via tiered models (route cheap tasks to smaller models), caching, batching, and credit metering (`16` budgets).
- **CAC:** blended, dominated by low-cost App Store + content; paid used surgically.
- **Payback:** <6 months on Growth/Pro.
- **LTV/CAC:** target ≥4x, driven by NRR >120% (expansion via usage + agent unlocks + seats).
- **Churn:** logo churn kept low by outcome proof (P10) and compounding memory (switching cost).

## Moat / defensibility
1. **Outcome data flywheel.** Every approved action + measured result trains our prioritization and impact-estimation models. Point apps can't accumulate cross-domain outcome data.
2. **Per-shop compounding memory** (`31`) — high switching cost; the product literally forgets less than a human employee.
3. **Deterministic safety rails + audit** — enterprise-grade trust competitors under-invest in.
4. **Multi-agent orchestration** — hard to copy well; single-shot "AI generate" features are commoditized.
5. **Shopify-native depth** — extensions, Functions, Flow integration create surface area rivals skip.
6. **Distribution + reviews** — App Store ranking and social proof compound.

## Risks & mitigations
| Risk | Mitigation |
|---|---|
| Shopify ships competing native AI (Sidekick/Magic) | Differentiate on orchestration, memory, cross-domain outcomes, reversible autonomy; stay a value-add layer, not a feature Shopify commoditizes |
| AI COGS erode margin | Credit metering, model tiering, caching, budgets |
| Trust incident (a bad auto-action) | Trust ladder, reversibility, audit, insurance, incident runbooks (`40`, `48`) |
| App Store rejection/removal | `43` compliance as acceptance criteria |
| Model provider dependency | Multi-provider abstraction (Anthropic + OpenAI), fallback (`16`) |

## KPIs (business)
MRR/ARR, NRR, gross margin, CAC payback, activation rate, WAS, MAVD, review rating, App Store rank for target terms.

## Edge cases
- Merchant on annual Shopify plan / Plus billing nuances → handle via Billing API plan mapping.
- Refunds/chargebacks and proration on plan changes → mid-cycle proration policy (`27`).
- Usage spikes → hard caps + alerts prevent both bill-shock and margin blowouts.

## Future expansion
Agent marketplace revenue share, benchmark data products (aggregated/anonymized/consented), professional services for enterprise, multi-platform expansion beyond Shopify. See `50`.

## Maintenance
Pricing reviewed quarterly against COGS and NRR. Shopify revenue-share and Billing terms re-verified each Shopify release; assumptions versioned here.
