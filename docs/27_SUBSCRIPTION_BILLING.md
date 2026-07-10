# 27 — Subscription & Billing

## Purpose
Define billing: Shopify Billing API integration, plan structure, AI-usage (AAC) metering, trials, upgrades/downgrades, caps, and App-Store-compliant billing UX.

## Goals
- 100% via Shopify Billing API (App Store requirement — no external payment for app charges).
- Value-aligned pricing (`02`) with margin-protecting usage metering.
- Zero bill-shock; transparent, one-click cancel.

## Ground truth & requirement
- App is `AppDistribution.AppStore`. Public apps MUST bill through Shopify's Billing API; do not use Stripe/external for the subscription itself. (We may use Stripe only for non-Shopify-billed enterprise contracts out-of-band, carefully.)
- No billing code exists yet — this is net-new (`app/lib/domain/billing`, `20`).

## Billing model
**Hybrid: recurring subscription (app subscription) + usage charges (metered AAC overage).**
- **App Subscription** = plan base fee (recurring), created via Billing API (`appSubscriptionCreate` GraphQL). Includes trial days.
- **Usage charges** = metered AAC overage beyond the plan's included allotment, via usage records against a capped usage line, with a merchant-visible **capped amount** (Shopify enforces the cap — hard protection against bill-shock).

### AI Action Credit (AAC) metering
- One AAC ≈ one agent task producing a recommendation or executing a mutation; chat turns cost fractional credits (`02`).
- Metering pipeline: each agent task/tool call records AAC consumption (`UsageRecord`, `18`) with `traceId` + agent id. Aggregated per shop per period. Overage beyond included allotment → Shopify usage charge (respecting cap).
- **Cost mapping:** AAC cost calibrated so plan margins hold given model COGS (`02`,`16`). Model-tier routing keeps most tasks cheap.

## Plans → entitlements
Plans defined in `02`/`26`. Billing sets `Subscription.planTier`; entitlement matrix (`26`) gates features. Plan tiers: Free, Growth ($49), Pro ($149), Scale/Plus ($499+), Enterprise (custom).

## Trials
- Free trial (e.g., 7–14 days) on paid plans via Billing API `trialDays`. Free tier is perpetual (no card).
- Trial UX: clearly show days left, what happens at end, easy cancel. No surprise charge.

## Lifecycle flows

### Subscribe / upgrade
1. Merchant picks plan (contextual upsell framed as MAVD, `13` `UpsellCard`).
2. Server creates app subscription (Billing API) → Shopify confirmation URL → merchant approves in Admin → return URL → verify + activate → update `Subscription` + entitlements.
3. `app_subscriptions/update` webhook (`24`) keeps state authoritative.

### Downgrade / cancel
- One-click (App Store requirement). Downgrade → schedule at period end (or immediate w/ proration policy); gracefully pause out-of-plan features/autonomies (`26`), keep config.
- Cancel → subscription cancelled via Billing API; app remains installed on Free (or uninstall separately).

### Usage & caps
- Show live AAC usage vs. allotment in-app (Settings → Plan). Approaching cap → warn; at cap → block metered actions + offer pack/upgrade (never silent overrun, `00` P7).
- Merchant-set hard cap on overage (≤ plan's capped amount). We never exceed it.

## Billing UX (`11`,`43`)
- Plan page: current plan, usage, included vs. used AAC, next bill date, upgrade/downgrade/cancel.
- Every gated feature shows *why* locked + upgrade CTA with value framing.
- Confirmations for plan changes; clear proration/timing messaging.
- Receipts/history via Shopify (Shopify handles invoicing/collection).

## Test vs. live charges
- Use Billing API **test mode** in development/dev stores (no real charges). Ensure production uses live. Never charge test stores.

## Metering integrity & abuse
- AAC recorded server-side only, tied to actual work (`UsageRecord`). Idempotent (no double-count on retry, `17`).
- Abuse/runaway protection: per-shop daily budgets + circuit breakers (`16`,`17`) cap both cost and charges.
- Reconcile our metering vs. Shopify usage records; alert on drift.

## Revenue recognition & finance
- Shopify collects + remits (minus revenue share). Track MRR/ARR, expansion (usage + upgrades → NRR), churn. Export billing events to analytics (`29`) for finance dashboards.
- Revenue-share assumption (0% under annual threshold, then 15%) versioned in `02`; re-verify each Shopify update.

## Security (`32`)
- Verify Billing confirmation return + `app_subscriptions/update` HMAC (`24`). Never trust client-reported plan; entitlements derive from server + webhook state. No card data touches us (Shopify handles it).

## Edge cases
- Merchant declines charge at confirmation → stay on prior/Free; no access granted.
- Charge approved but return interrupted → webhook reconciles; idempotent activation.
- Downgrade with configured autonomies beyond new plan → pause + notify, keep config.
- Cap reached mid-agent-task → finish in-flight safely, block new metered work, upsell.
- Refund/dispute → handle per policy; adjust entitlements on `app_subscriptions/update`.
- Uninstall → cancel subscription, stop metering, teardown (`24`).
- Plan/price change (we change pricing) → grandfather existing or migrate with notice; version pricing.
- Currency/locale → display localized; Shopify handles settlement currency.

## Testing (`36`)
- Billing test-mode e2e (subscribe/upgrade/downgrade/cancel), webhook reconciliation, usage metering accuracy + idempotency, cap enforcement (never exceed), entitlement gating per plan, trial expiry, and no-bill-shock tests. Never run against a live store in CI.

## Future expansion
Annual plans/discounts, seat-based add-ons, usage packs, agency org-level billing, enterprise out-of-band contracts, and dynamic value-based pricing experiments (`50`).

## Decisions (ADR)
- **ADR-027-1:** All app billing via Shopify Billing API; no external payment for app charges.
- **ADR-027-2:** Hybrid subscription + capped metered AAC; Shopify-enforced cap prevents bill-shock.
- **ADR-027-3:** Entitlements derive from server + `app_subscriptions/update` webhook, never client claims.

## Maintenance
Owned by PM + Backend. Pricing/plan/AAC changes update `02`,`26`, and this doc together. Re-verify Billing API + revenue-share terms each Shopify release (`43`). Metering reconciliation monitored continuously.
