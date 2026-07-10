# 43 — App Store Approval

## Purpose
The definitive checklist + process to pass Shopify App Store review on the first attempt and stay compliant. App Store approvability is a first-class acceptance criterion (`00` P5).

## Goals
- Meet every Shopify requirement (technical, listing, privacy, billing, performance).
- A repeatable pre-submission self-review that mirrors Shopify's review.
- Zero rejection-fatal patterns in the product.

## Shopify requirement categories (self-review checklist)

### 1. Authentication & install (`25`)
- [ ] OAuth via latest managed flow; installs/reinstalls cleanly.
- [ ] Session-token auth on embedded requests; no cookie reliance in iframe.
- [ ] App immediately authenticates + redirects properly; no broken first-load.
- [ ] Offline-token handling incl. expiring-offline-tokens refresh (`25`).
- [ ] Uninstall cleans up (webhook, token invalidation).

### 2. Embedded app & App Bridge (`21`,`22`)
- [ ] Embedded in Admin via latest App Bridge; `NavMenu`, `TitleBar`, SaveBar, toasts, modals native.
- [ ] No layout breakage in the iframe; correct CSP/frame-ancestors headers (`addDocumentResponseHeaders`).
- [ ] Works in Shopify mobile app; responsive.
- [ ] Polaris UI; looks native (`11`).

### 3. Mandatory webhooks & GDPR (`24`,`44`) — HARD BLOCKER
- [ ] `customers/data_request`, `customers/redact`, `shop/redact` implemented + verified (currently commented out — **must enable**).
- [ ] `app/uninstalled` handled (exists).
- [ ] All webhooks HMAC-verified; fast-ack.

### 4. Billing (`27`) — HARD BLOCKER for paid apps
- [ ] All charges via Shopify Billing API (no external payment for app).
- [ ] Clear pricing, trial, usage caps (no bill-shock); test charges in dev only.
- [ ] One-click cancel; graceful downgrade.

### 5. Scopes & permissions (`26`)
- [ ] Least-privilege scopes; each justified; no unused scopes requested.
- [ ] Progressive scope requests where possible; scope-update handled.

### 6. Performance (`33`)
- [ ] Meets Shopify performance expectations; fast load; no jank.
- [ ] Theme App Extension doesn't harm storefront Core Web Vitals (`23`).

### 7. Privacy & data (`44`,`32`)
- [ ] Privacy policy, terms, cookie policy published + linked (`44`,`45`,`46`).
- [ ] Data minimization; secure token/PII handling; DPA with sub-processors (AI providers, ESP, hosting).
- [ ] Clear disclosure of AI usage + data sent to third-party model providers.
- [ ] Honor consent (storefront tracking) (`29`).

### 8. Functionality & quality
- [ ] App does what the listing claims; no broken/placeholder features.
- [ ] No errors on core flows; empty/error states handled (`11`,`40`).
- [ ] Test/demo instructions + credentials provided to reviewer.
- [ ] No misleading/deceptive UX; honest CRO (no fake urgency/social proof) (`23`,`00`).

### 9. Listing quality (`35`)
- [ ] Accurate name, tagline, description (no keyword stuffing), correct category/tags.
- [ ] High-quality screenshots (real UI), demo video, clear value prop, honest claims.
- [ ] Support contact + resources (`47`).

### 10. Accessibility (`34`)
- [ ] WCAG 2.2 AA on core flows.

### 11. AI-specific (emerging Shopify + trust expectations)
- [ ] Transparent AI: label AI-generated content/actions; explain what agents do.
- [ ] Human control: reversible actions, approval gates, audit (`00` P2/P3).
- [ ] No autonomous actions that could harm the store without consent.
- [ ] Accurate outputs; no fabricated store data; safe handling of customer data in prompts.
- [ ] Disclose third-party AI processors in privacy policy.

## Pre-submission process
1. **Self-review** against this checklist (all boxes) on staging (App-review-like env, `38`).
2. **Reviewer test account:** seed a demo store + instructions covering key flows (install → scan → action → undo → chat → billing test).
3. **Compliance dry-run:** trigger GDPR webhooks + verify export/delete (`24`,`44`).
4. **Security + a11y + perf gates** green (`32`,`34`,`33`).
5. Submit; track feedback; fix + resubmit fast.

## Common rejection reasons (avoid proactively)
- Missing/broken GDPR webhooks. External billing. Requesting unused scopes. Broken embedded auth/first-load. Misleading listing/claims. Poor performance. No privacy policy / undisclosed AI data processing. Deceptive UX. Unhandled errors/empty states. App doesn't match description.

## Post-approval / ongoing compliance
- Re-verify each **Shopify Edition/API version** (`22`,`49`); keep pinned version supported.
- Maintain webhook + billing + scope compliance as features evolve; every new scope re-justified.
- Monitor App Store policy updates; treat new requirements as roadmap items.
- Keep listing accurate as features ship.

## Edge cases
- Scope added later → re-consent flow + listing/privacy update.
- New AI capability → re-check AI transparency + privacy disclosures.
- Policy change mid-cycle → prioritize compliance fix (`00` decision framework).
- Reviewer can't reproduce → better demo data + instructions.

## Testing (`36`)
- Automated compliance tests (webhooks, billing test-mode, scope gating), e2e reviewer-flow rehearsal, a11y/perf/security gates. A "submission-readiness" CI check aggregates these.

## Future expansion
Built for Shopify (BFS) status pursuit (higher bar: performance, UX, support), app awards, and staying ahead of AI-app policy as Shopify formalizes it (`50`).

## Decisions (ADR)
- **ADR-043-1:** GDPR compliance webhooks + Shopify Billing are launch-blocking; enabled + tested before submission.
- **ADR-043-2:** AI transparency, reversibility, and disclosure of AI sub-processors are treated as approval requirements.
- **ADR-043-3:** Approvability is checked per-feature (`00` DoD), not just at submission.

## Maintenance
Owned by PM + the "App Review" hat. Checklist re-run before every submission + major release. Updated each Shopify policy/Edition change. Keep synced with `24`,`26`,`27`,`44`.
