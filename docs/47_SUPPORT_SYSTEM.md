# 47 — Support System

## Purpose
Define how we support merchants: channels, tooling, SLAs, self-serve, escalation, and how support feeds the product. Great support is an App Store signal (`43`), a retention lever, and a trust builder (`00` P1).

## Goals
- Fast, empathetic, effective support that scales with AI assistance.
- Tight loop: support insights → product fixes.
- Enterprise-grade SLAs for higher tiers.

## Support tiers & SLAs
| Plan | Channels | First-response SLA | Hours |
|---|---|---|---|
| Free/Starter | Self-serve, in-app Copilot, email | best-effort (~48h) | business |
| Growth | + email | ~24h | business |
| Pro | + priority email/chat | ~8h | extended |
| Scale/Plus | + priority chat | ~4h | extended |
| Enterprise | + dedicated CSM, SLA | contractual (e.g., 1–2h critical) | per SLA |
- **Severity-based** for all: Sev-1 (app down / harmful action / billing error) fastest regardless of tier; Sev-2 degraded; Sev-3 question/how-to.

## Channels
1. **In-app self-serve** — contextual help, docs, and the **Copilot as support agent** (answers product questions, guides fixes) (`15`).
2. **Help center / docs** — searchable guides, FAQs, videos, troubleshooting, agent explainers.
3. **Email/ticketing** — support@trymerchantai.com → helpdesk (e.g., Zendesk/Front/Plain).
4. **Chat** — for paid tiers.
5. **Status page** — incidents/uptime (`39`,`40`).
6. **Community/changelog** — later.

## Tooling
- Helpdesk with merchant context integration: a support agent sees the shop's plan, recent actions (audit `41`), errors (`40`), and health — **with strict access controls + audit** (`26`,`32`). No unfettered PII access.
- Internal per-shop debug dashboard (`39`) for diagnosing issues quickly.
- Macros + AI-drafted replies (reviewed) for speed + consistency.

## AI-assisted support
- **Tier-1 deflection:** in-app Copilot + help-center search resolve common questions (how-to, "why did the agent do X," billing basics) using our own product knowledge — dogfooding our AI.
- **Agent-context answers:** "why did this action happen?" answered from the audit log + agent reasoning (transparency `00` P3).
- **Escalation:** unresolved / sensitive / Sev-1 → human. AI never fabricates support answers; it defers when unsure.

## Escalation path
`Self-serve/Copilot → Tier-1 human → Tier-2 (technical/eng on-call) → Incident (Sev-1, runbook `48`) → Eng/Leadership`. Billing issues → billing owner; security/privacy → Security/Legal (`32`,`44`).

## The "action went wrong" flow (critical, `09` Flow 8)
- Prominent in-app **"Undo + Report"** on any action; report auto-attaches audit context (`41`) so support has full history instantly.
- Sev-1 if an autonomous action caused harm → immediate human + possible kill-switch (`16`) + post-mortem (`48`).

## Feedback loop → product
- Tag tickets by theme; weekly review of top issues → bugs/feature requests into the backlog (`06`,`49`).
- Track support metrics as product-quality signals; recurring issues become roadmap items.
- Churn/uninstall reasons captured + analyzed (`29`).

## Metrics / KPIs
- First-response + resolution time (by tier/severity), CSAT/NPS, deflection rate (self-serve/Copilot), ticket volume per 100 shops (quality signal), reopen rate, escalation rate, uninstall-with-support correlation.

## Security & privacy in support (`32`,`44`)
- Least-privilege support access to merchant data; every access audited; PII minimized/masked; verify requester identity for sensitive actions; never expose one merchant's data to another. Support tooling access role-gated.

## Accessibility & inclusivity (`34`)
- Accessible help center + channels; plain language (`05`); multi-timezone coverage as we scale; localization (`50`).

## Edge cases
- Sev-1 during off-hours → on-call + status page + kill-switch.
- Merchant reports data/privacy concern → Security/Legal path + timelines (`32`,`44`).
- Billing dispute → billing owner + Shopify Billing reconciliation (`27`).
- Angry merchant post-bad-action → empathy + immediate undo + root-cause + follow-up.
- Support agent needs deep data → time-boxed, audited elevated access.
- High volume spike (incident) → status page + macro comms to reduce ticket flood.

## Testing / quality
- Support runbooks tested; macros reviewed; AI support answers evaluated for accuracy (no fabrication); access-control + audit verified (`36`).

## Future expansion
24/7 coverage, in-app live chat with agent handoff, community forum, CSM motion for enterprise, proactive support (detect a struggling shop + reach out), and AI-summarized ticket triage (`50`).

## Decisions (ADR)
- **ADR-047-1:** Severity overrides tier for critical issues (harm/down/billing) — Sev-1 always fastest.
- **ADR-047-2:** Support access to merchant data is least-privilege + fully audited; AI support never fabricates.
- **ADR-047-3:** Every "action went wrong" report auto-attaches audit context for instant diagnosis.

## Maintenance
Owned by Support + PM. SLAs reviewed per plan changes; runbooks (`48`) current; feedback loop into backlog weekly; metrics monitored. Keep help center synced with shipped features.
