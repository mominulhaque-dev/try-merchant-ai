# 00 — Master Prompt & Operating Charter

## Purpose

This document is the **constitution** of TryMerchantAI. It defines how the company — human and AI — makes decisions, what "done" means, and the non-negotiable principles every other document inherits. When any downstream doc is ambiguous, this charter breaks the tie.

It doubles as the **system-level operating context** for our internal AI agents (see `16_AI_AGENT_ARCHITECTURE.md`). Anything an autonomous agent is allowed to do on a merchant's store traces back to a rule here.

## Goals

1. Encode a single, durable definition of the product and its guardrails.
2. Make decisions reproducible: anyone (or any agent) applying these principles to the same facts should reach the same call.
3. Prevent scope drift, security regressions, and App-Store-fatal patterns before they enter code.

## The one-sentence definition

> TryMerchantAI is an **AI Commerce Operating System** that sits inside Shopify Admin as an embedded app and, through a chat copilot plus a fleet of specialized autonomous agents, observes the store, recommends actions, and — with the merchant's permission — executes them safely across SEO, CRO, marketing, analytics, inventory, support, content, email, and theme.

## Operating principles (normative)

### P1 — Merchant trust is the product
The merchant is handing an AI the keys to their revenue. Every feature MUST be defensible under the question: *"Would a careful store owner be comfortable if they watched us do this?"* If not, it requires explicit, scoped, revocable consent.

### P2 — Human-in-the-loop by default, autonomy by graduation
Agents operate on a trust ladder: **Suggest → Draft → Approve-to-execute → Auto-execute (reversible) → Auto-execute (guarded)**. New capabilities enter at *Suggest*. A capability only graduates after it demonstrates low error rates and has a proven rollback. Destructive or irreversible actions (bulk price changes, publishing themes, sending to full email lists) MUST NOT auto-execute without an explicit per-action or standing, revocable authorization.

### P3 — Everything reversible, everything logged
Any store mutation an agent performs MUST be (a) recorded in an immutable audit log with before/after state, and (b) reversible or clearly labeled as irreversible with a confirmation gate. See `41_LOGGING.md`, `40_ERROR_HANDLING.md`.

### P4 — Least privilege, always
Request the minimum Shopify scopes needed for enabled features, and request them progressively as features are activated (`26_PERMISSION_SYSTEM.md`). Never request a scope "just in case."

### P5 — Shopify-native, not Shopify-adjacent
We build with Polaris, App Bridge, Admin GraphQL, Theme App Extensions, Functions, Flow, Metaobjects, and the Billing API. We do not reinvent Shopify primitives or fight the platform. App Store approval is a first-class acceptance criterion, not an afterthought.

### P6 — Deterministic rails around probabilistic cores
LLMs propose; deterministic code disposes. Every agent action passes through typed tool schemas, validation, policy checks, and dry-run previews before touching a live store. The AI never has raw, unvalidated write access to the Shopify Admin API.

### P7 — Cost is a design constraint
Token spend, API call budgets, and job concurrency are engineered, metered, and attributable per shop. An agent that cannot explain its cost cannot ship. See `27_SUBSCRIPTION_BILLING.md` (metering) and `16` (budgets).

### P8 — Enterprise-grade or not shipped
No beginner code, no placeholder architecture, no unbounded queries, no unhandled promise rejections, no secrets in code. If it can't survive 10,000 shops, it isn't done.

### P9 — Privacy and compliance are load-bearing
GDPR/CCPA data-subject flows (`customers/data_request`, `customers/redact`, `shop/redact`) are implemented before public launch. PII is minimized, encrypted, and never sent to a model provider without contractual data protection and de-identification where feasible. See `32_SECURITY.md`, `44_PRIVACY_POLICY.md`.

### P10 — Measure or it didn't happen
Every feature ships with instrumentation: activation, usage, outcome (did the recommendation improve the metric?), and error telemetry. Outcome attribution is the moat (P for "proof of ROI").

## Definition of Done (DoD)

A unit of work is done only when ALL hold:

- [ ] Meets the acceptance criteria in the relevant PRD/feature spec.
- [ ] TypeScript strict passes (`npm run typecheck`), lint clean (`npm run lint`).
- [ ] Unit + integration tests written and green; critical paths have e2e coverage (`36_TESTING.md`).
- [ ] No new Shopify scope added without an entry in `26_PERMISSION_SYSTEM.md`.
- [ ] Any store mutation is audit-logged and reversible-or-gated (P3).
- [ ] Polaris + WCAG 2.2 AA compliant for any UI (`34_ACCESSIBILITY.md`).
- [ ] Performance budget respected (`33_PERFORMANCE.md`).
- [ ] Observability: logs, metrics, and error reporting wired (`39_MONITORING.md`).
- [ ] Docs updated (this repository) — code and docs never diverge silently.
- [ ] Passes the App Store self-review checklist for affected areas (`43_APP_STORE_APPROVAL.md`).

## Decision framework (how to break ties)

When two paths conflict, prefer in this order:
1. **Merchant safety & trust** (P1, P3)
2. **App Store approvability** (P5)
3. **Security & privacy** (P4, P9)
4. **Long-term maintainability & scalability** (P8)
5. **Speed of shipping**

Speed never outranks the four above. This ordering is deliberate and non-negotiable.

## AI agent system prompt contract

Every internal agent's system prompt MUST inherit and restate, in its own words:
- Its **single responsibility** and explicit **out-of-scope** list.
- Its **trust-ladder level** (P2) and what requires human approval.
- Its **tool allowlist** — the exact typed tools it may call (`16`, `19`).
- Its **budget** — max tokens/calls/cost per task and per day.
- Its **refusal rules** — when to stop and escalate to a human.
- Its **memory scope** — what it may read/write in the memory system (`31`).

No agent may be granted a tool not enumerated in its allowlist. Tool grants are code, not prose.

## What we are NOT building (anti-scope)

- Not a general chatbot untethered from commerce actions.
- Not a headless storefront or a theme builder from scratch.
- Not a payment processor, PSP, or money-transmitter.
- Not a data broker — we never sell merchant or customer data.
- Not a "prompt box" wrapper — the value is the deterministic rails, memory, and outcome attribution around the model, not the model itself.

## Edge cases this charter must survive

- **Model provider outage:** agents degrade to Suggest-only using cached context; no queued mutation is lost (see `17`, `40`).
- **Merchant revokes a scope mid-workflow:** in-flight jobs requiring that scope halt, roll back partials, and notify (`26`, `40`).
- **Conflicting agent actions** (e.g., SEO Agent and Content Agent both edit a product): a single-writer lock per resource + a reconciliation policy prevents clobbering (`16`, `17`).
- **App uninstall:** all offline tokens invalidated, jobs cancelled, data retention timer started per policy (`24`, `42`, `44`).

## Maintenance

- This document changes rarely and only by CEO+CTO sign-off. Every change is an ADR entry below.
- Downstream docs cite principles by ID (e.g., "per P3"). If a principle is renamed, grep the repo and update references.

## Decisions (ADR)

- **ADR-000-1 (2026-07-10):** Adopt React Router 7 as the app framework of record (matches actual codebase); Remix template is deprecated and will not be reintroduced.
- **ADR-000-2 (2026-07-10):** Anthropic Claude is the primary reasoning model; OpenAI is the secondary/fallback and specialist model. Rationale in `16`.
- **ADR-000-3 (2026-07-10):** Trust ladder (P2) governs all agent autonomy. Default entry level is Suggest.
