# 16 — AI Agent Architecture

## Purpose
Define the runtime, safety model, and specification for TryMerchantAI's agent fleet — the core IP. This is how probabilistic models are wrapped in deterministic rails to act safely on real stores (`00` P6).

## Goals
- A single, uniform agent runtime all 12 agents share.
- Deterministic safety: typed tools, policy checks, previews, budgets, audit.
- A trust ladder (`00` P2) that lets autonomy grow safely.

## Architecture overview
```
                 ┌──────────────────────────────────────────┐
 Merchant ──────▶│  Orchestrator (router + planner)          │
 (chat / event)  │  - intent classify (cheap model)          │
                 │  - route to agent(s), compose plan         │
                 └───────────────┬──────────────────────────┘
                                 │
                   ┌─────────────▼─────────────┐
                   │  Agent Runtime (shared)    │
                   │  system prompt + policy    │
                   │  memory ctx (31)           │
                   │  tool allowlist (typed)    │
                   │  budget + telemetry        │
                   └───────┬───────────┬────────┘
                           │           │
                 ┌─────────▼──┐   ┌────▼─────────┐
                 │ Tool layer │   │ Policy layer │  (deterministic gates)
                 │ (typed,    │   │ scope/auth/  │
                 │  validated)│   │ trust ladder │
                 └─────┬──────┘   └────┬─────────┘
                       │               │
              ┌────────▼───────────────▼─────────┐
              │ Action Pipeline                    │
              │ validate→dry-run→approve→execute   │
              │ →verify→audit(41)→undo             │
              └────────┬───────────────────────────┘
                       │
        Shopify Admin GraphQL / DB / external APIs (22,19)
   All heavy/async work runs as BullMQ jobs (17). Model calls via provider abstraction.
```

## Core components

### Orchestrator
- Classifies intent (cheap model), selects agent(s), builds an execution plan, enforces single-writer locks across agents, merges multi-agent results. Backs the Copilot (`15`) and event/automation triggers (`17`).

### Agent Runtime (shared)
Every agent is an instance of one runtime configured by a declarative **AgentSpec** — no bespoke per-agent frameworks. Uniformity = maintainability + auditability.

```ts
interface AgentSpec {
  id: AgentId;                    // 'seo' | 'cro' | ...
  displayName: string;
  responsibilities: string[];     // single-responsibility scope
  outOfScope: string[];           // explicit non-goals
  systemPrompt: string;           // inherits 00 charter
  tools: ToolName[];              // ALLOWLIST — grants are code
  memoryScope: MemoryScope;       // read/write regions (31)
  defaultTrustLevel: TrustLevel;  // enters at 'suggest'
  maxTrustLevel: TrustLevel;      // ceiling by capability + plan
  budget: { maxTokensPerTask: number; maxCallsPerTask: number; dailyAAC: number };
  model: { primary: ModelRef; fallback: ModelRef; cheap: ModelRef };
  fallback: FallbackPolicy;       // on model/tool failure
  monitoring: { slo: string; alerts: string[] };
}
```

### Tool layer (typed, deterministic)
- Tools are typed functions with JSON-schema args + results; server-side validation; each maps to a read or a mutation. Write tools return a proposed action, not a direct mutation.
- A tool grant is explicit in `AgentSpec.tools`. No agent can call a tool it wasn't granted (enforced in code, not prompt). See `19` for the tool catalog + schemas.

### Policy layer (the deterministic veto)
Runs on every proposed tool/action regardless of model output:
- Scope check (Shopify scope present, `26`), plan/entitlement check (`27`), trust-ladder check (is this action allowed to auto-execute at the agent's current level?), budget check, rate-limit, single-writer lock, and business-rule validation. Any failure → block + explain + (if appropriate) request approval/authorization.

### Action pipeline
`validate → dry-run/preview(diff) → approval(per trust ladder) → execute → verify → audit(41) → undo token`. Shared by chat, findings, and automations. Irreversible actions require explicit confirm and never auto-execute below the guarded level.

### Model provider abstraction
- Uniform interface over **Anthropic (Claude, primary)** and **OpenAI (secondary/specialist)** + a **cheap tier** for classification/formatting. MCP (`Model Context Protocol`) used to expose our tools to models in a standard, portable way where applicable. Provider failover is automatic (`fallback`). Never hard-couple to one vendor.

## Trust ladder (autonomy) — `00` P2
| Level | Behavior | Example |
|---|---|---|
| Suggest | Recommends only | "Your title is too long" |
| Draft | Prepares change, doesn't apply | Drafts new title, awaits click |
| Approve-to-execute | Applies on explicit per-action approval | Merchant clicks Fix it |
| Auto (reversible) | Executes unattended, reversible + audited | Auto-add alt text to new products |
| Auto (guarded) | Executes unattended within strict guardrails/caps | Auto-fix within allowlist, ≤N/day, revert on anomaly |
New capabilities enter at Suggest. Graduation requires: measured low error rate, proven undo, and merchant opt-in. Irreversible actions never below guarded + explicit consent.

## The 12 agents
Each conforms to `AgentSpec` and has: **Responsibilities · Out-of-scope · Tools · Memory · Prompt focus · Workflow · Fallback · Monitoring.** Summaries:

1. **Store Health Agent** — orchestrates cross-domain audit, aggregates findings, prioritizes. Tools: read catalog/theme/inventory/analytics; emits findings (no direct writes). Memory: store profile, prior findings. Fallback: cached last scan. Monitors: scan success rate, first-finding latency.
2. **SEO Agent** — titles, meta, alt text, structured data, URL/handle hygiene, sitemap/robots signals. Tools: product/page read+update, metafields, image alt update. Memory: keyword/context prefs, past edits. Fallback: suggest-only. Monitors: SERP-adjacent metrics, edit revert rate.
3. **CRO Agent** — PDP/cart friction, trust signals, layout/copy tests, upsell/bundle ideas. Tools: theme/section read, product/content read, experiment config (via theme extension `23`). Memory: conversion baselines. Fallback: suggest.
4. **Marketing Agent** — campaign ideas, promotions, calendar, channel suggestions; orchestrates email/content agents. Tools: read analytics, propose campaigns. Memory: brand voice, past campaigns.
5. **Analytics Agent** — metrics, anomalies, trend explanations, MAVD attribution (`29`,`30`). Tools: analytics read, report build. Memory: KPI baselines. Fallback: last report.
6. **Inventory Agent** — stockout/overstock risk, reorder suggestions, dead-stock, demand hints. Tools: inventory + orders read, (gated) inventory updates. Memory: velocity baselines. Fallback: suggest.
7. **Support Agent** — drafts/answers customer inquiries, FAQ from catalog/policies. Tools: read policies/products, (gated) reply drafts. Memory: tone, canned answers. Fallback: draft-only; never auto-send sensitive replies without approval.
8. **Content Agent** — product descriptions, collection copy, blog, brand-consistent tone. Tools: product/page/blog read+update. Memory: brand voice, style. Fallback: draft.
9. **Email Agent** — flows/campaign drafts, subject lines, segmentation ideas; integrates ESPs (e.g., Klaviyo) rather than replacing (`03`). Tools: ESP APIs (gated), analytics read. Memory: deliverability + performance. Fallback: draft; sending to full lists requires explicit approval.
10. **Workflow Agent** — builds/manages automations across agents (`17`); the "if-this-then-that" brain with guardrails. Tools: automation config. Memory: enabled automations. Fallback: suggest.
11. **Theme Agent** — theme performance, app-block placement, section improvements via Theme App Extensions (`23`); publishing themes is irreversible-class → guarded + explicit. Tools: theme read, extension config. Memory: theme baseline. Fallback: suggest.
12. **Recommendation Agent** — product recommendations, cross/upsell logic, personalization signals. Tools: catalog/orders read, recommendation config. Memory: affinity data. Fallback: suggest.

> Every agent's write tools produce previewed, reversible-or-gated actions. No agent has raw Admin write access.

## Multi-agent coordination
- **Single-writer lock** per resource (product/theme/etc.) prevents clobbering when agents overlap (`00` edge cases).
- **Reconciliation:** conflicting proposals surfaced to orchestrator → merged or escalated to merchant.
- **Shared memory** (`31`) so agents don't contradict each other; **event bus** so one agent's action can inform another.

## Budgets, cost, monitoring (`00` P7)
- Per-task token/call caps; per-shop daily AAC budget metered to billing (`27`).
- Model tiering routes cheap work to small models.
- Every agent emits telemetry: tokens/cost, latency, tool calls, action outcomes, error/refusal rates, revert rate (`39`). SLOs + alerts per agent.

## Fallback & failure
- Model outage → provider failover → cheap model → Suggest-only from cache. Tool failure → retry/backoff → safe abort + rollback partials + notify (`40`). Queued work never lost (`17`).

## Security (`32`)
- Tenant isolation by shop scoping on every query/tool. Prompt-injection defenses (untrusted store content delimited, policy layer authoritative). Secrets never in prompts. PII minimized to providers. Full audit of every action (`41`).

## Edge cases
- Scope/entitlement revoked mid-task → policy layer halts + rolls back + notifies.
- Runaway loop / repeated failing action → circuit breaker + cap + alert.
- Conflicting merchant edit during agent action → optimistic concurrency, re-preview.
- Provider returns malformed tool args → schema validation rejects, retry or abort.

## Testing (`36`)
Per-agent scenario suites (golden tasks), policy-layer unit tests (every gate), injection red-team tests, budget-enforcement tests, failover tests, and undo/rollback tests for every write tool. Evaluation harness scores agent quality over a fixed benchmark set each release.

## Future expansion
Agent SDK/marketplace (third-party agents on this runtime), agent-to-agent planning, learned prioritization from outcome data (the flywheel), and per-vertical agent tuning (`50`).

## Decisions (ADR)
- **ADR-016-1:** One shared runtime + declarative `AgentSpec`; no bespoke agent frameworks.
- **ADR-016-2:** Write tools never execute directly from a model; always via the action pipeline.
- **ADR-016-3:** Policy layer is authoritative over model output — deterministic veto.

## Maintenance
Owned by AI Architect. New agents require a full `AgentSpec` + scenario suite + Security review of tool grants before enablement. Prompts + tool catalogs versioned.
