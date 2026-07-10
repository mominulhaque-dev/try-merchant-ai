# 28 — Notification System

## Purpose
Define how TryMerchantAI notifies merchants: in-app, email, and digests — across channels, with preferences, batching, and delivery reliability. Notifications are how proactive value (new findings, completed actions, alerts) reaches the merchant.

## Goals
- Timely, relevant, non-annoying notifications (respect attention).
- Reliable delivery with retries + audit.
- Preference controls + compliance (unsubscribe, quiet hours).

## Channels
1. **In-app** — Polaris `Banner`/`Toast` (transient) + a persistent notification center/inbox; badge counts on nav. For real-time/session events (action done, scan complete).
2. **Email** — transactional (action results, alerts, digests) via a provider (e.g., Resend/SES/Postmark). For async/cross-session reach.
3. **Digest** — batched weekly/daily summary (findings, ROI/MAVD, actions, alerts) — the primary proactive engagement driver.
4. **Future:** Slack, SMS, push (mobile), webhook-out for enterprise.

## Notification types
| Type | Channel(s) | Example | Priority |
|---|---|---|---|
| Action completed | in-app + optional email | "Added alt text to 12 images · undo" | normal |
| Action failed | in-app + email | "Couldn't update title — retry" | high |
| New high-impact finding | in-app + digest | "Big SEO win available" | normal |
| Scan complete | in-app + optional email | "Health scan done: 8 findings" | low |
| Automation run/anomaly | in-app + email | "Auto-pause: metric dropped" | high |
| Billing/usage | in-app + email | "80% of AAC used" | high |
| Alert (stockout risk) | in-app + email + digest | "3 products stocking out" | high |
| Weekly ROI digest | email | MAVD + wins summary | normal |
| Compliance/security | email | data request received | high |

## Architecture
```
Event (domain) → Notification service → 
  resolve recipient prefs + role (26) → 
  choose channels + batch policy → 
  enqueue (notify queue, 17) → 
  render (template + locale) → 
  send (provider) → 
  record delivery + status → retry on fail → audit
```
- Notifications are jobs (`17`): never block the request path; retried on failure; idempotent (no duplicate sends).
- **Batching:** low-priority events accumulate into digests; high-priority send immediately. Prevents notification fatigue.
- **Deduplication:** collapse repeated events (e.g., 50 product updates → one summary).

## Preferences (`26`,`09` Settings)
- Per-merchant + per-user: channel toggles per type, digest frequency (off/daily/weekly), quiet hours, email opt-in/out.
- Sensible defaults: high-priority always on (can't fully silence billing/security/failure alerts, but can choose channel); marketing-style off by default.
- Role-aware: billing notifications to Owner/Admin; operational to Operators (`26`).

## Email specifics
- **Deliverability:** authenticated domain (SPF/DKIM/DMARC), warm reputation, transactional vs. marketing separation, unsubscribe link on non-critical, honor bounces/complaints (suppress list).
- **Compliance:** CAN-SPAM/GDPR — clear sender, unsubscribe, no dark patterns; transactional (action results) vs. marketing (tips) distinction (`44`).
- **Templates:** branded (`05`), accessible HTML + plain-text fallback, localized, deep-link to the exact finding/action (`10`).

## Reliability & delivery
- Retries with backoff; provider failover (secondary ESP) for critical mail; delivery status tracked; failed critical notifications surfaced in-app as fallback.
- Rate limiting per shop to avoid spamming; global send throttles.

## Observability (`39`)
- Metrics: sent/delivered/opened/failed/unsubscribed per type + channel; digest engagement; notification→action click-through (feeds engagement). Alert on delivery failure spikes.

## Security & privacy (`32`,`44`)
- No sensitive PII/customer data in emails beyond necessity; shop-scoped; no cross-tenant leakage; suppression list honored; content sanitized; links signed where they trigger actions.

## Edge cases
- Notification storm (bulk operation) → coalesce into one summary.
- Merchant unsubscribed but critical alert → send critical via in-app + minimal transactional email (billing/security can't be fully silenced, disclosed in prefs).
- Email bounce/complaint → suppress + surface in-app.
- Quiet hours vs. urgent alert → urgent overrides quiet hours (disclosed).
- Uninstalled shop → stop all non-compliance notifications; send offboarding once (`24`).
- Localization/RTL → templates adapt (`34`).
- Duplicate event delivery → idempotent send dedupe.

## Testing (`36`)
- Template rendering (locales, plain-text), preference honoring (each toggle), batching/dedup, delivery retry + failover, unsubscribe + suppression, quiet-hours logic, deep-link correctness, and no-cross-tenant tests.

## Future expansion
Slack/SMS/push, notification center with rich history, per-agent notification streams, AI-summarized "what happened while you were away," and enterprise webhook-out (`50`).

## Decisions (ADR)
- **ADR-028-1:** All notifications are jobs (retried, idempotent); batching by priority prevents fatigue.
- **ADR-028-2:** Critical (billing/security/failure) notifications can change channel but not be fully silenced; disclosed in prefs.

## Maintenance
Owned by Backend + PM. New notification types register: template, channels, default prefs, priority, batching, tests. Monitor deliverability + engagement; prune noisy types.
