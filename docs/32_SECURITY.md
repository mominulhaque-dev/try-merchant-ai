# 32 — Security

## Purpose
Define the security posture: threat model, controls, data protection, AI-specific security, and compliance readiness. Security is a top-3 tie-breaker (`00` decision framework) and an App Store gate (`43`).

## Goals
- Protect merchant + shopper data and the merchant's store from harm (including harm by our own AI).
- Defense-in-depth; deny-by-default; least privilege.
- Pass Shopify security requirements + enterprise security reviews.

## Threat model (STRIDE-ish, key assets)
**Assets:** Shopify access tokens, merchant/shopper PII, our DB, AI provider keys, the ability to mutate a merchant's store.
**Adversaries:** external attackers, malicious/compromised merchants (multi-tenant abuse), prompt-injection via store content, insider risk, supply-chain.

| Threat | Vector | Control |
|---|---|---|
| Token theft | DB breach, logs, client exposure | Encrypt tokens at rest, never client-side, never in logs, least scope, rotate/revoke on uninstall (`25`) |
| Cross-tenant access | Missing shop filter | Mandatory `shop` guard every query/tool; tests; consider Postgres RLS (`18`,`26`) |
| Prompt injection | Malicious product/customer text → tool abuse | Untrusted content delimited; policy layer authoritative over model; tool allowlists; no direct writes from model (`15`,`16`) |
| Privilege escalation | Weak authz | Four-gate authz (scope+plan+role+trust) server-side (`26`) |
| Webhook forgery | Fake webhook → action | HMAC verify 100% (`24`) |
| SSRF/tool abuse | Malicious tool inputs | Input validation, no arbitrary URL fetch, egress controls (`19`) |
| Bill/cost abuse | Runaway AI usage | Budgets, caps, circuit breakers (`16`,`27`) |
| Data exfiltration via AI | Model leaks another tenant's data | Shop-scoped context only; de-identify; provider DPAs (`31`) |
| Supply chain | Malicious dependency | Lockfile, SCA scanning, pinned deps, review (`37`) |
| Insider | Over-broad internal access | RBAC, least-privilege infra, audit, secrets isolation |

## Identity, auth, authz (`25`,`26`)
- Shopify session-token validation on every embedded request; HMAC on webhooks + OAuth; offline-token refresh handling.
- Four-gate authorization for mutations; deny-by-default; server-side only; step-up for high-risk actions.
- Tenant isolation as the first check in every data path.

## Data protection
- **In transit:** TLS everywhere (app, DB, Redis, providers).
- **At rest:** managed encryption; column-level encryption for tokens + sensitive fields (`18`).
- **PII minimization:** collect + store minimum; de-identify before sending to model providers where feasible; short retention; redaction flows (`24`,`44`).
- **Secrets:** in a secret manager (not env files in repo, not DB, not logs); rotation policy; separate per environment.
- **Key management:** provider keys scoped + rotated; no keys in client bundles.

## AI-specific security (`15`,`16`,`31`)
- **Deterministic policy layer** vetoes any model-proposed action violating scope/authz/budget/trust — model output is never trusted to be safe by itself.
- **Prompt-injection defenses:** delimit + label untrusted store content; instructions never taken from data; tool allowlists; output schema validation; no raw Admin write from model.
- **Data boundary:** only shop-scoped, minimized, de-identified data to providers; provider data-processing agreements; opt out of provider training where offered.
- **Guardrails:** budgets, rate limits, circuit breakers, anomaly-revert (`17`), full audit of every action (`41`).

## Application security
- Input validation (Zod) on all boundaries; output encoding (XSS); CSRF handled by same-site + session-token model; secure headers + CSP (`addDocumentResponseHeaders`, `25`); no eval/dynamic code; dependency pinning + SCA (`37`).
- SSRF/egress: tool network calls restricted to allowlisted destinations (Shopify, providers, our services).

## Infrastructure security (`37`,`38`)
- Least-privilege cloud IAM; network segmentation (web/worker/DB/Redis); private DB/Redis (no public exposure); WAF/CDN (Cloudflare) in front; secrets isolated per env; immutable infra + IaC review.
- Container hardening (minimal base images, non-root, no secrets in images).

## Logging & audit (`41`)
- Immutable audit log for all store mutations + permission/billing/compliance events (actor, before/after, traceId). No PII/secrets in application logs. Security events monitored + alerted (`39`).

## Vulnerability management
- SCA + SAST in CI; Dependabot/renovate; regular dependency updates; secret scanning; periodic pentest (esp. pre-App-Store + enterprise); responsible-disclosure/security.txt; bug bounty (later).

## Incident response (`40`,`48`)
- Runbook: detect → contain → eradicate → recover → post-mortem. Token revocation, kill-switch (global agent halt), customer + regulator notification per law. Defined severities + on-call.

## Compliance (`44`,`43`)
- GDPR/CCPA: data-subject rights (access/delete) via compliance webhooks + processes (`24`); DPA with sub-processors (providers, ESP, hosting); privacy by design.
- Shopify: mandatory compliance webhooks, secure token handling, minimal scopes, no prohibited data use (`43`).
- SOC 2 readiness as an enterprise-sales enabler (future); maintain control evidence early.

## Edge cases
- Compromised merchant account → their scope limits our blast radius; suspicious-activity detection; kill-switch.
- Provider breach → rotate keys, assess exposure (only de-identified data sent).
- Malicious store content targeting our AI → injection defenses + policy layer.
- Mass abuse (many fake installs) → rate limits, anomaly detection, install validation.
- Insider mistake → least privilege + audit + revocable access limit damage.

## Testing (`36`)
- Authz/tenant-isolation tests (no cross-shop, no escalation), HMAC tests, injection red-team suite, secret-scanning in CI, SCA/SAST gates, dependency-audit, and periodic pentest. Security tests are launch-blocking.

## Future expansion
SOC 2 Type II, ISO 27001, SSO/SCIM, customer-managed encryption keys, data residency options, formal bug bounty (`50`).

## Decisions (ADR)
- **ADR-032-1:** Deterministic policy layer is authoritative over AI output; model never has raw store-write access.
- **ADR-032-2:** Tenant isolation (`shop` guard) is the first check in every data path; enforced + tested.
- **ADR-032-3:** Only minimized, de-identified, shop-scoped data leaves to model providers under DPA.

## Maintenance
Owned by Security. Every feature threat-modeled at design; new scopes/tools/providers security-reviewed. Security posture re-audited each release + each Shopify Edition; incident runbook drilled.
