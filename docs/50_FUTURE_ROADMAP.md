# 50 — Future Roadmap

## Purpose
Lay out the 0–36 month trajectory from the current React Router 7 scaffold to the AI Commerce Operating System, sequenced by value + risk. This is directional (dates are quarters, revisited quarterly), not a commitment contract.

## Goals
- A credible path from wedge → OS → platform.
- Sequencing that compounds (each phase feeds the moat: outcome data, memory, distribution).
- Explicit "graduation gates" for autonomy + scale.

## Guiding sequence
**Wedge (Store Health + Copilot) → Multi-agent OS → Autonomy graduation → Platform/marketplace → Multi-channel/enterprise.** Each phase must be safe, approvable, and proven before the next.

## Phase 0 — Foundation hardening (Q3 2026, now)
*Turn the scaffold into a production baseline.*
- SQLite → **PostgreSQL** migration (`18`); add **Redis + BullMQ** (`17`); provider abstraction (Anthropic + OpenAI + MCP) (`16`).
- Core infra: CI/CD, IaC, Docker web+worker, observability, backups (`37`–`42`).
- Auth/session hardening incl. offline-token refresh (`25`); tenant isolation everywhere (`32`).
- **Exit gate:** enterprise baseline (security, observability, tests) green.

## Phase 1 — Wedge MVP (Q3–Q4 2026)
- **Store Health Agent** + **Copilot** + **action pipeline** (preview→approve→execute→undo) + audit (`14`,`15`,`16`).
- First domain agents: **SEO, Content, CRO, Analytics** (Suggest/Approve).
- Onboarding zero-config aha; activation instrumentation + MAVD v1 (`29`).
- Billing (plans + AAC) via Shopify Billing (`27`); GDPR webhooks (`24`).
- **Design-partner alpha → beta.**
- **Exit gate:** activation ≥ target; safe reversible execution proven; App Store self-review green (`43`).

## Phase 2 — GA + Multi-agent OS (Q1 2027)
- **App Store launch** (public) — compliance complete (`43`).
- Add agents: **Email, Marketing, Inventory, Support, Recommendation** (`16`).
- **Automation engine** merchant-facing (triggers, guardrails, kill-switch) (`17`).
- **Theme App Extension** storefront blocks (recommendations, CRO, experiments) (`23`).
- Notifications + Reporting/ROI (`28`,`30`); AI memory system live (`31`).
- **Autonomy graduation:** low-risk reversible actions → Auto (reversible), gated by eval + safety (`36`).
- **Exit gate:** paying-shop growth, NRR trend, review rating, low mutation-error/revert rate.

## Phase 3 — Deepening + Theme/Workflow agents (Q2–Q3 2027)
- **Theme Agent** (guarded) + **Workflow Agent** (`16`); Shopify **Functions** + **Flow** integration (`22`).
- **Admin UI extensions** (contextual "optimize with AI" on resource pages).
- Guarded autonomy for more action classes; anomaly-revert maturity (`17`).
- Seats/RBAC + governance for scaling brands + agencies (`26`).
- Benchmark/data insights (anonymized, consented) as content + product (`29`,`02`).
- **Exit gate:** enterprise-readiness signals (governance, audit, SSO pilots).

## Phase 4 — Platform & Marketplace (Q4 2027–Q1 2028)
- **Agent SDK + marketplace:** third parties build agents on our runtime (`16`); revenue share (`02`).
- **Public API + MCP server** exposing our tools/data to external models + integrations (`19`).
- Multi-store / **agency org layer** (org roles, per-client governance, white-label) (`26`,`08` Riya).
- **Exit gate:** ecosystem traction; platform reliability at higher scale.

## Phase 5 — Multi-channel & Enterprise (2028+)
- **Multi-channel:** TikTok Shop, Amazon, Markets (international/multi-currency), POS, B2B/wholesale (`22`).
- **Enterprise:** SSO/SCIM, data residency, SOC 2 Type II / ISO 27001, custom governance + SLAs, CSM motion (`32`,`47`).
- **Localization** across major markets (`34`).
- **Proactive/predictive:** the OS forecasts (demand, churn, stockouts) and proposes plans; approaches the "AI employee" vision (`01`).
- **Exit gate:** enterprise logos, multi-channel GMV under management, defensible outcome dataset.

## Long-term vision (3–5 yr, `01`)
The autonomous **AI employee that runs the ecommerce business**: states of intent → coordinated agent execution → measured outcomes → plain-language reporting, with full reversibility + governance. Eventually a horizontal commerce-agent platform beyond Shopify.

## Cross-cutting continuous tracks
- **Autonomy graduation** (ongoing): each capability climbs the trust ladder only via eval + safety + opt-in (`16`,`36`).
- **Moat compounding:** outcome data → better prioritization + impact estimates (`29`); memory depth → switching cost (`31`).
- **Cost/margin engineering:** model tiering, caching, budgets keep gross margin ≥75% (`00` P7,`02`).
- **Compliance/security:** stay ahead of Shopify AI-app policy + privacy law (`43`,`44`,`32`).
- **Design system + a11y** maturity (`12`,`34`).

## Prioritization framework
Sequence by **(value × confidence) / (effort × risk)**, with hard gates for safety/compliance/approvability (`00` decision framework). Nothing that risks merchant trust ships early to chase growth.

## Risks to the roadmap (`03`)
- Shopify-native AI encroachment → move up-stack (orchestration/memory/proof/governance).
- Autonomy trust incident → conservative graduation, reversibility, audit.
- AI cost/latency → engineering discipline.
- Platform dependency → Shopify-native now, multi-platform later.

## Success metrics by horizon
- **12mo:** GA, first thousands of paying shops, activation + review targets, ≥1 agent at Auto (reversible).
- **24mo:** NRR >120%, multiple agents auto, agency traction, marketplace beta.
- **36mo:** enterprise + multi-channel, platform ecosystem, defensible outcome dataset, venture-scale ARR (`02`).

## Decisions (ADR)
- **ADR-050-1:** Wedge-first (Store Health + Copilot); the OS expands agent-by-agent, never launched as a monolith.
- **ADR-050-2:** Autonomy graduates only through eval + safety gates + merchant opt-in — growth never overrides trust.
- **ADR-050-3:** Platform/marketplace comes after the multi-agent OS is proven, not before.

## Maintenance
Owned by CEO/CTO/PM. Revisited quarterly against funnel + market data (`04`); phases re-sequenced as learning dictates; major shifts logged as ADRs in `00`. Dates are quarters, deliberately revisable.
