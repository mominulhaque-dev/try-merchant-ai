# 46 — Cookie Policy

> ⚠️ **Legal notice:** Engineering-grade **draft template**, not legal advice. Finalize with counsel before publishing (TryMerchantAI.com/cookies). Must reflect the actual cookies/trackers we set — keep the inventory below accurate.

## Purpose
Disclose what cookies + similar technologies TryMerchantAI uses across the embedded app, marketing site, and storefront extensions, and how users can control them. Ties to Privacy Policy (`44`) + consent handling (`29`,`23`).

## Scope
Covers: TryMerchantAI.com (marketing), the embedded Admin app, and Theme App Extension storefront components (`23`). Note the embedded app runs inside Shopify Admin, where session tokens (not cookies) drive auth (`25`) — so first-party cookie use in-app is minimal.

## What are cookies / similar tech
Small files or storage (cookies, localStorage, pixels) set on a device to enable functionality, remember preferences, secure sessions, and measure usage.

## Categories we use
1. **Strictly necessary** — security, load balancing, session/CSRF protection, app functionality. Cannot be disabled; no consent required (legitimate necessity). (In-app, auth is via Shopify session tokens; minimal cookies.)
2. **Preferences** — remember settings/UI choices (e.g., dismissed banners, theme).
3. **Analytics (marketing site + consented storefront)** — measure usage to improve the product (`29`). On the marketing site, subject to consent where required. On merchant storefronts, our extension tracks **only pseudonymous events with shopper consent** (Shopify Customer Privacy API) (`23`,`29`).
4. **Marketing (marketing site only, consent-based)** — attribution/retargeting if/when used; consent-gated.

## Cookie inventory (keep current — example structure)
| Name | Category | Purpose | Party | Duration |
|---|---|---|---|---|
| `__session`/session token | Necessary | Auth/session (app) | First | Session |
| `csrf` | Necessary | CSRF protection | First | Session |
| `tma_prefs` | Preferences | UI preferences | First | ~1yr |
| `_tma_analytics` | Analytics | Usage analytics (consented) | First/processor | ~1yr |
| (provider cookies) | Analytics/Marketing | e.g., product analytics tool | Third | varies |
> Engineering MUST keep this table matching what actually ships. Do not list cookies we don't set; do not set cookies not listed.

## Storefront tracking + consent (`23`,`29`,`44`)
- Our storefront blocks respect the shopper's consent status via Shopify's Customer Privacy/consent framework. **No analytics/tracking without consent.** Data is pseudonymous; no selling of data.

## How to control cookies
- **Consent banner** (marketing site, and honoring storefront consent) to accept/reject non-essential categories; preferences changeable anytime.
- Browser controls to block/delete cookies (may break some functionality).
- Merchant/shopper rights per Privacy Policy (`44`).
- We honor "Do Not Track"/global privacy signals where legally required.

## Third parties
Analytics/monitoring/marketing processors may set cookies under their policies; listed in the inventory + sub-processor list (`44`). We don't use cookies to sell personal data.

## Changes
Updated as our cookie use changes; material changes notified.

## Contact
privacy@trymerchantai.com.

## Implementation notes (engineering)
- Maintain the inventory in code (a single source that generates the banner categories + this table).
- Consent state gates non-essential scripts (don't load analytics before consent).
- Storefront: gate on Shopify consent API; test consent-withheld path (`23`,`36`).
- Any new cookie/tracker → update inventory + `44` + legal review.

## Maintenance
Owned by Legal + FE. Inventory audited each release (no undocumented cookies). Consent logic tested (`36`). Reviewed on new trackers or privacy-law changes.
