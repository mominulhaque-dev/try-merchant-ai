# 44 — Privacy Policy

> ⚠️ **Legal notice:** This is an engineering-grade **draft template**, not legal advice. It MUST be reviewed + finalized by qualified counsel before publishing. It reflects our actual data practices so counsel can adapt it. Publish the final version at TryMerchantAI.com/privacy and link it in the App Store listing (`43`).

## Purpose
Disclose transparently what data TryMerchantAI collects, why, how it's used (including AI processing), who it's shared with, and the rights merchants + shoppers have. Privacy-by-design is a principle (`00` P9) and an approval requirement (`43`).

## Scope & roles
- **Controller/Processor:** For merchant account data, we are a **controller**. For a merchant's store/customer data we process on their behalf, we act as a **processor** under the merchant's instructions (a DPA governs this).
- Applies to: the app (embedded in Shopify Admin), TryMerchantAI.com, storefront extensions, and communications.

## Data we collect
**From merchants (account):** name, email, store domain, role, billing/plan info (billing handled by Shopify — we don't store card data), support communications, product usage/analytics (`29`).
**From the Shopify store (processed on merchant's behalf, per granted scopes `26`):** product/catalog data, orders (aggregate/metrics), inventory, theme data, shop settings, and — minimized — customer data where a feature requires it (e.g., Support Agent context). We **minimize** customer PII and avoid it where possible.
**From storefront (consent-gated `23`,`29`):** pseudonymous events (page/product views, add-to-cart) only with shopper consent.
**Automatically:** logs, device/usage, IP (security/diagnostics), cookies (`46`).

## Why we use it (purposes + legal bases)
- Provide the service (perform the contract): run scans, agents, recommendations, actions.
- **AI processing:** generate recommendations + execute approved actions using AI models (see AI section).
- Improve the product + prioritization (legitimate interest; aggregated/de-identified).
- Billing + account management; support; security + fraud prevention (legitimate interest / legal obligation); communications (consent/legitimate interest, with opt-out).

## AI & third-party model providers (explicit disclosure — `43`)
- We use third-party AI providers (**Anthropic**, **OpenAI**) to power agents/copilot.
- We send only the **minimum necessary, de-identified** data required for a task; we avoid sending customer PII to providers where feasible and minimize/pseudonymize where unavoidable.
- Providers process data under **data-processing agreements**; we seek terms where data is **not used to train** their models (or opt out where offered).
- We disclose which providers we use + update this list as it changes. Merchants are informed that AI processing occurs.

## Sharing / sub-processors
We share data only with sub-processors necessary to run the service, under contract: hosting/cloud, managed Postgres/Redis, AI providers (above), email/notification provider (`28`), error/analytics/monitoring tools (`39`), and Shopify. We maintain a **sub-processor list** (published + kept current). We do **not sell** merchant or shopper data (`00`).

## International transfers
Data may be processed in other countries; we use appropriate safeguards (e.g., SCCs) for cross-border transfers.

## Retention (`41`,`42`)
- Held only as long as needed for the purposes above or as legally required. App logs short (30–90d); audit longer (compliance); AI prompt logs de-identified + short (30d). On uninstall + `shop/redact`, shop data is deleted per policy (backups expire within a disclosed window `42`).

## Data-subject / merchant rights (GDPR/CCPA)
- Access, rectification, erasure, restriction, portability, objection; California rights (know/delete/opt-out of "sale" — we don't sell).
- **How exercised:** merchants via in-app controls (view/edit/delete agent memory `31`, data export, uninstall) + contacting privacy@trymerchantai.com. Shopper requests are routed through the merchant (their controller) and honored via Shopify's compliance webhooks:
  - `customers/data_request` → we compile + provide the customer's data.
  - `customers/redact` → we delete that customer's PII.
  - `shop/redact` → we delete the shop's data.
  (Implemented + verified per `24`.)

## Security (`32`)
- Encryption in transit + at rest, least-privilege access, token/PII protection, audit, incident response. No method is 100% secure; we work to enterprise standards.

## Children
Not directed at children; we don't knowingly collect children's data.

## Cookies
See the Cookie Policy (`46`).

## Changes
We'll post updates here + notify for material changes.

## Contact
Data controller/DPO contact + privacy@trymerchantai.com + postal address (to be finalized).

## Implementation notes (for engineering, not the published doc)
- Keep this synced with actual sub-processors + scopes (`26`) + webhook implementation (`24`).
- Publish sub-processor list as a living page.
- Every new data flow / provider / scope updates this policy + triggers legal review (`43`).

## Maintenance
Owned by Legal + Security. Reviewed on every new sub-processor, scope, or AI-data-flow change, and at least annually. Counsel sign-off required before any published change.
