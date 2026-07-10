# Development Roadmap (Phase 2)

> Milestones → tasks → subtasks, with dependencies + risks. Derived from `50_FUTURE_ROADMAP.md` and the conflict resolutions in `00_IMPLEMENTATION_PLAN.md`. Execution order follows dependency, not doc number. TodoWrite mirrors the near-term slice.

## Legend
- **Dep:** hard prerequisite. **Risk:** what can go wrong + mitigation.
- Status: ☐ todo · ◐ in progress · ☑ done.

---

## M0 — Foundation hardening (Phase 0 of doc 50)
*Goal: production baseline the whole app builds on, without breaking local dev.*

### M0.T1 — Error taxonomy ☐  `app/lib/errors`
- Subtasks: `AppError` base; typed `ErrorCode` (doc 19: `UNAUTHENTICATED, SCOPE_MISSING, PLAN_REQUIRED, RATE_LIMITED, THROTTLED_SHOPIFY, VALIDATION, CONFLICT, PROVIDER_UNAVAILABLE, BUDGET_EXCEEDED, NOT_FOUND, INTERNAL`); `retryable` flag; user-safe message vs internal detail; `toResponse()` + envelope; `Result<T,E>` helper.
- Dep: none. Risk: low.

### M0.T2 — Structured logging ☐  `app/lib/telemetry`
- Subtasks: JSON logger (levels); `traceId` field; **PII/secret scrubber** (deny-list keys) (doc 41); child-logger with bound context; no-PII guarantee; never throws / never blocks.
- Dep: T1 (uses error types). Risk: PII leakage → scrubber + tests.

### M0.T3 — Validated env/config ☐  `app/lib/config`
- Subtasks: typed `env` accessor; required vs optional; fail-fast on missing critical at server boot; dev/prod awareness; no secrets logged. (Zod deferred per C-3 → hand-rolled now.)
- Dep: T1/T2. Risk: boot crash on missing env → clear message + `.env.example` at T7.

### M0.T4 — IDs, trace, tenant guard ☐  `app/lib/ids`, `app/lib/security`
- Subtasks: id gen (cuid-like, dep-free), `newTraceId()`; **`ShopScoped<T>` brand + `assertShop()`** so unscoped shop access is a type error (doc 32 improvement); authz gate scaffold (four-gate: scope+plan+role+trust, doc 26) as pure predicates.
- Dep: T1. Risk: over-engineering → keep minimal, extend at M1.

### M0.T5 — Agent runtime contracts ☐  `app/lib/agents/types.ts`
- Subtasks: `TrustLevel` ladder, `AgentId` union (12 agents, doc 16), `AgentSpec`, `ToolSpec` (typed input/output/sideEffect/requiredScopes/requiredPlan/cost, doc 19), `ActionProposal` shape. Pure types + const catalogs, no runtime yet.
- Dep: T1/T4. Risk: churn as runtime lands → types are additive.

### M0.T6 — Verify foundation ☐
- `npm run typecheck` + `npm run lint`. Dep: T1–T5.

### M0.T7 — Postgres + Redis cutover (staged, documented) ☐
- Subtasks: `docker-compose.yml` (PG16 + Redis7); `.env.example`; switch `schema.prisma` to `postgresql` + `env("DATABASE_URL")`; retire SQLite migration; full domain schema (doc 18: Shop, AgentState, ScanRun, Finding, ActionRecord, AuditLog, Automation, AutomationRun, ChatSession, ChatMessage, MemoryItem, Subscription, UsageRecord, Event + enums); keep `Session` adapter-compatible; add `zod`, `bullmq`, `ioredis` to deps; runbook.
- Dep: T1–T6. **Risk (high):** breaks dev if run wrong / no Docker → mitigation: compose + `.env.example` + runbook; user runs `docker compose up -d && npm run setup`; reversible (git).

### M0.T8 — Queue infra + worker ☐ `app/lib/queue`, `workers/`
- Queues (doc 17 topology), worker entrypoint, graceful drain, idempotency helper, per-shop rate limit, DLQ. Dep: T7.

### M0.T9 — AI provider abstraction ☐ `app/lib/ai`
- Anthropic (primary) + OpenAI (fallback) interface; model tiering; budget guard; MCP tool exposure; streaming. Dep: T5, T7. Risk: cost/latency → budgets + tiering.

---

## M1 — Wedge MVP (Phase 1 of doc 50)
*Goal: Store Health + Copilot + reversible action pipeline + first agents.*

- **M1.T1 Repositories + domain services** (shop, scan, findings, actions) over Prisma (doc 20). Dep: M0.T7.
- **M1.T2 Action pipeline** validate→dry-run/preview→approve→execute→verify→audit→undo (docs 07/16/40/41). Dep: M0.T5, M1.T1. Risk: correctness of undo → tests + before-state capture.
- **M1.T3 Policy layer** (four-gate authz + trust ladder + budget + single-writer lock) (docs 16/26). Dep: M1.T2.
- **M1.T4 Tool catalog (read + mutation tools)** typed, validated, Shopify GraphQL via codegen (docs 19/22). Dep: M0.T9, M1.T3.
- **M1.T5 Store Health Agent + scan jobs** (doc 14/16), fan-out per-dimension, findings. Dep: M0.T8, M1.T4.
- **M1.T6 Dashboard** (`app._index.tsx` replace demo) with `s-*` UI, states, deferred loading (docs 14/21, C-1/C-5). Dep: M1.T5.
- **M1.T7 Findings UI** list+detail+Fix-it→ActionPreview (docs 09/13). Dep: M1.T2, M1.T6.
- **M1.T8 Copilot chat** streaming endpoint + `s-*` chat UI + grounding + tool-use + approval (docs 15/16/31). Dep: M0.T9, M1.T4.
- **M1.T9 First domain agents** SEO, Content, CRO, Analytics as `AgentSpec`s (doc 16). Dep: M1.T4.
- **M1.T10 Billing** plans + AAC metering via Billing API + entitlement gates (docs 26/27). Dep: M1.T1.
- **M1.T11 Nav IA** extend `<s-app-nav>` to doc-10 sections as routes land (C-5). Dep: per-route.
- **M1.T12 GDPR compliance webhooks** enable 3 topics + handlers (docs 24/43, C-6). Dep: M0.T8.
- **M1.T13 Analytics events + MAVD v1** (doc 29). Dep: M0.T8, M1.T1.

## M2 — GA + Multi-agent OS (Phase 2 of doc 50)
Email/Marketing/Inventory/Support/Recommendation agents; automation engine (UI + guardrails + kill-switch); Theme App Extension blocks; notifications; reporting/ROI; memory system; autonomy graduation to Auto(reversible). Dep: M1. Risk: autonomy safety → eval + red-team gate (doc 36).

## M3 — Deepening
Theme + Workflow agents; Functions + Flow; Admin UI extensions; seats/RBAC; benchmarks. Dep: M2.

## M4 — Platform & Marketplace
Agent SDK/marketplace; public API + MCP server; agency org layer. Dep: M3.

## M5 — Multi-channel & Enterprise
Multi-channel; SSO/SCIM; SOC2/ISO; data residency; localization; predictive. Dep: M4.

---

## Cross-cutting tracks (continuous, every milestone)
- **Testing** (doc 36): Vitest unit/integration, Playwright e2e, axe a11y, AI safety/red-team suite. Added alongside code, not after.
- **Security** (doc 32): threat-model each feature; tenant isolation tests; HMAC; secret hygiene.
- **Observability** (docs 39/41): metrics + traceId + dashboards + runbooks per service.
- **CI/CD + IaC** (docs 37/38): GitHub Actions, Docker web+worker, staged deploy, flags.
- **Accessibility** (doc 34): WCAG 2.2 AA on every UI increment.
- **Docs sync** (doc 00 DoD): update SSOT + this roadmap per change; log ADRs.

## Top risks (program-level)
| Risk | Mitigation |
|---|---|
| DB cutover breaks local dev | docker-compose + `.env.example` + runbook; reversible; foundation-first |
| Autonomous action harms a store | trust ladder default Suggest; reversible+audit; kill-switch; red-team gate |
| AI COGS blow margin | model tiering, budgets, caching, AAC metering |
| Env can't run PG/Redis/providers here | ship runnable artifacts + runbook; verify what compiles; flag the rest honestly |
| Shopify-native AI encroachment | orchestration + memory + outcome-proof moat (doc 03) |
| Scope infinite ("forever") | thin verifiable slices; TodoWrite; per-increment DoD |

## Current execution slice
M0.T1–T5 foundation ☑, action pipeline (M1.T2) ☑, and **M1.T6 Dashboard ☑** (real Store Health quick scan replaces the template demo; `app/lib/domain/store-health` + `app/routes/app._index.tsx`). Next: **M0.T7 Postgres/Redis cutover** (artifacts ready) to unblock persistence, then M1.T7 Findings UI + Fix-it wired to the action pipeline. Live status tracked in `/project_state`.
