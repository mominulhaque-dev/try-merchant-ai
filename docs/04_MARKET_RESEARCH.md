# 04 — Market Research

## Purpose
Size the opportunity, define the ideal customer, and validate demand with a research plan. Grounds pricing (`02`) and roadmap (`50`) in reality.

## Goals
- Defensible TAM/SAM/SOM.
- A precise ICP and segmentation.
- A continuous demand-validation loop, not a one-time guess.

## Market context
Shopify powers on the order of millions of active stores across ~175 countries and tens of billions in annual GMV flowing through the platform's merchants. The Shopify App Store hosts thousands of apps; the average established merchant runs many apps simultaneously — evidence of both spend appetite and tool fatigue. Ecommerce operations software plus the labor it replaces (agencies, VAs, specialists) is a large, fragmented spend pool that AI is now positioned to consolidate. (Figures are directional; validate against current Shopify investor data and re-version.)

## Market sizing (model, not a single number)

We size by **bottom-up** to avoid vanity TAM.

- **TAM (Total):** All Shopify merchants who could benefit from AI ops × plausible annual willingness-to-pay for ops/optimization tooling + displaced human labor. Directionally multi-billion USD.
- **SAM (Serviceable):** English-first, Admin-active merchants above a minimum GMV threshold (enough revenue to justify $49–$499/mo and to generate data agents can act on) on plans that support app installs — a large subset of active stores.
- **SOM (Obtainable, 3-yr):** A realistic low-single-digit % penetration of SAM. Example target lattice: 25,000 paying shops at a blended ~$120/mo ≈ ~$36M ARR. This is the number we plan against; TAM is context, SOM is the goal.

> Rule: never plan on TAM. Plan on SOM. Re-derive SOM quarterly from funnel data.

## Ideal Customer Profile (ICP)

**Primary ICP — "The overwhelmed operator":**
- Solo founder or small team (1–10 people) on Shopify Basic/Growth/Advanced.
- Revenue band roughly $10k–$500k/mo GMV (enough to pay, enough data to act on, no in-house specialists).
- Wears all hats; no dedicated SEO/CRO/email specialist.
- Already runs 5–12 apps; feels tool fatigue; values time as much as money.
- Comfortable with AI but wary of losing control → our trust ladder resonates.

**Secondary ICP — "The scaling brand":**
- 10–50 people, $500k–$5M/mo GMV, possibly Plus.
- Has some specialists but they're stretched; wants leverage + governance + seats.
- Cares about audit, roles, SSO → our enterprise features.

**Tertiary ICP — "The agency":**
- Manages 10–200 client stores; wants a force multiplier and multi-store dashboard; high LTV.

## Segmentation
- **By size:** micro / SMB / mid-market / Plus-enterprise (drives plan + autonomy defaults).
- **By vertical:** apparel, beauty, home, supplements, electronics, etc. (drives agent tuning — e.g., apparel needs variant/size CRO; supplements need subscription retention).
- **By maturity:** new store (needs setup/health) vs. established (needs optimization/scale).
- **By channel mix:** single-store vs. multi-channel (future expansion).

## Jobs To Be Done (JTBD) — top validated jobs
1. "Tell me what's wrong with my store and what to fix first." (Store Health)
2. "Improve my product pages so they rank and convert." (SEO + CRO + Content)
3. "Recover revenue I'm leaving on the table." (CRO, email, recommendations)
4. "Keep me from stocking out or over-buying." (Inventory)
5. "Answer my customers without me sitting in the inbox." (Support)
6. "Just do the busywork and show me it worked." (Automation + proof)

Full JTBD → personas in `08_USER_PERSONAS.md`.

## Demand signals (why belief is justified)
- App fatigue + consolidation trend → appetite for an operator layer.
- Explosive adoption of AI copilots in adjacent SaaS (code, sales, support) proving willingness to delegate to agents.
- High spend on agencies/VAs by SMB merchants → a labor budget AI can capture.
- Shopify's own heavy AI investment validates the category (rising tide) while leaving orchestration/memory open.

## Pricing sensitivity (hypotheses to test)
- SMBs anchor on "one app ≈ $10–$50/mo." Our value narrative (replaces multiple apps + hours of labor) must justify $49–$149.
- Van Westendorp + fake-door tests to find acceptable price points per tier.
- Willingness-to-pay rises sharply once MAVD (proven ROI) is visible in-app.

## Research plan (continuous)
1. **Discovery interviews** (n≥30 across ICPs) — pains, current stack, willingness to delegate.
2. **App Store review mining** — scrape competitor reviews for unmet needs + churn reasons.
3. **Fake-door / landing tests** on TryMerchantAI.com — measure intent per feature/price.
4. **Design-partner cohort** (10–20 stores) — deep instrumentation, weekly feedback.
5. **In-product analytics** post-launch (`29`) — behavior > opinions.
6. **Cohort ROI studies** — prove MAVD to feed sales + content.

## Risks in the market read
- Overestimating willingness to grant autonomy (mitigate: strong Suggest tier, gradual trust).
- Underestimating Shopify-native encroachment (mitigate: watchlist `03`).
- Macro/ecommerce downturn compresses SMB software budgets (mitigate: ROI-first positioning — we make money, not cost money).

## Edge cases
- Non-English / non-US merchants: large but needs localization (`34`, `50`) before serviceable.
- Very small stores (<$10k GMV): low data + low WTP → free tier only; not a target for paid conversion.

## Future expansion
Additional serviceable markets unlock via: localization, multi-channel (TikTok/Amazon), B2B/wholesale, and platform expansion beyond Shopify (`50`).

## Maintenance
SOM re-derived quarterly from funnel data; sizing figures re-verified against latest Shopify disclosures; interview cadence continuous. Material findings → update `01`, `02`, `06`.
