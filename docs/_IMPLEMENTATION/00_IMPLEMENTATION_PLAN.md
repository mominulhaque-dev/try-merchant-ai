# Implementation Plan (Phase 1)

> Status: living. Owner: Principal Engineering. The `/docs` 00–50 set is the SSOT for *intent*; this plan is the SSOT for *how we build it against the real codebase*. Where the SSOT conflicts with the actual repository or current Shopify best practice, the resolutions below govern.

## 1. Baseline: what actually exists (verified 2026-07-11)

Read from the repo, not assumed:

- **Framework:** React Router 7 (`react-router@7.12`, `@react-router/*@7.12`) via `@shopify/shopify-app-react-router@1.1`. `app/routes.ts` uses `flatRoutes()` from `@react-router/fs-routes`.
- **UI:** **Polaris web components** (`<s-page>`, `<s-section>`, `<s-button>`, `<s-stack>`, `<s-app-nav>`, `<s-link>` …) rendered inside Admin. `useAppBridge()` from `@shopify/app-bridge-react` provides `toast`, `intents`. **There is no `@shopify/polaris` React package** — only `@shopify/polaris-types` (types for the web components). `AppProvider` comes from `@shopify/shopify-app-react-router/react`.
- **Auth:** `authenticate.admin`, `authenticate.webhook`, offline tokens with `future.expiringOfflineAccessTokens: true`. API version `2025-10` (`ApiVersion.October25`). Config in `app/shopify.server.ts`.
- **DB:** SQLite (`prisma/schema.prisma` → `provider = "sqlite"`, `url = "file:dev.sqlite"`), **one migration exists**: `prisma/migrations/20240530213853_create_session_table`. Only the `Session` model. `db.server.ts` exports a singleton `PrismaClient`.
- **Existing routes:** `app.tsx` (auth shell + `<s-app-nav>`), `app._index.tsx` (template demo: product/variant/metaobject mutations), `app.additional.tsx`, `auth.$.tsx`, `auth.login/*`, `webhooks.app.uninstalled.tsx` (deletes sessions), `webhooks.app.scopes_update.tsx` (updates scope), `_index/route.tsx` (public landing).
- **Webhooks (toml):** `app/uninstalled`, `app/scopes_update` active. **GDPR compliance topics commented out.**
- **Tooling:** ESLint (`.eslintrc.cjs`), Prettier, `graphql-codegen`, `typecheck` (`react-router typegen && tsc --noEmit`). ESM, Node `>=20.19 <22 || >=22.12`. Workspaces: `extensions/*` (none yet).
- **Not present:** Postgres, Redis, BullMQ, AI providers, `zod`, any `app/lib`, tests, CI, Docker, `.env.example`, theme/admin extensions.

## 2. Non-negotiable constraints (from the brief)

- Never re-init the app, never create a second app, never destroy existing architecture. **Extend only.**
- **Never break local dev** (`npm run dev` must keep working).
- Production-ready only: no TODOs, placeholders, dead code, demo code, fake logic.

These two — "extend only / don't break dev" and "full enterprise architecture (Postgres/Redis/AI)" — are in tension. Section 3 resolves it.

## 3. Conflict register & resolutions

Per the brief: never ask; choose the better enterprise solution; explain; continue.

### C-1 — UI: React Polaris (docs 11/13/14/21) vs Polaris **web components** (reality)
**Resolution:** Build all UI with **Polaris web components (`s-*`)** + App Bridge, matching the actual template. This is Shopify's current App Home direction and avoids shipping a second UI runtime. Docs 13/14/21 component contracts are honored *semantically* (states, a11y, tokens) but implemented as `s-*` + thin React wrappers, not `@shopify/polaris` React components. `IndexTable`/`Modal`/`Banner` map to their `s-*` equivalents. **Action:** treat `13_COMPONENT_LIBRARY.md`'s "Polaris-first" as "Polaris-web-components-first." No `@shopify/polaris` dependency will be added.

### C-2 — DB: Postgres+pgvector+enums (doc 18) vs SQLite + existing migration (reality) + "don't break dev"
**Resolution:** **Staged Docker-backed cutover**, not an in-place silent swap.
- The full domain schema (enums, JSON, vector) cannot run on SQLite, so Postgres is required and correct (doc 18 is right).
- To honor "don't break dev," the cutover ships with `docker-compose.yml` (Postgres 16 + Redis 7), `.env.example`, and a one-time `docker compose up -d && npm run setup`. After that, `npm run dev` works locally exactly as before.
- The old SQLite migration is retired and replaced by a fresh Postgres baseline migration (no production data exists → safe, per doc 18). The `Session` model stays adapter-compatible.
- **Sequencing:** the DB cutover is its own milestone task (M0.T7) done deliberately with the user able to run it, *after* the dependency-free foundation (M0.T1–T5) which needs no DB and cannot break dev. This is why foundation-first is the correct order.
- **pgvector:** used for AI memory (doc 31). If the managed Postgres lacks the extension, memory retrieval degrades to structured-only until enabled — coded behind an interface so it's swappable (managed vector store alternative).

### C-3 — Validation lib: docs say Zod (19/21) — not installed
**Resolution:** Zod is the right choice and will be added at the DB/queue milestone (with other runtime deps: `bullmq`, `ioredis`, provider SDKs) in a single reviewed dependency PR. **The dependency-free foundation (M0.T1–T5) uses only already-installed packages** so it compiles and cannot break dev today. Hand-rolled typed guards in the foundation are later composed with Zod at the boundary, not replaced.

### C-4 — Model provider: doc says Anthropic primary + MCP
**Resolution:** Keep. Provider abstraction wraps Anthropic (primary) + OpenAI (fallback/specialist) behind one interface; MCP exposes our tool catalog. Latest model IDs used (Claude family) per `claude-api` reference at build time. Added at M0.T6-provider milestone.

### C-5 — Nav: doc 10 lists 7 top-level sections; template nav is `<s-app-nav>` with 2 links
**Resolution:** Extend `<s-app-nav>` in `app.tsx` to the IA from doc 10 (Home, Copilot, Findings, Agents, Automations, Reports, Settings) as routes are built — added incrementally so nav never points at a dead route. The template demo in `app._index.tsx` is replaced by the real Dashboard (doc 14) at the Dashboard milestone; until then it stays functional (no dead nav).

### C-6 — GDPR webhooks commented out (toml) vs launch-blocking (docs 24/43)
**Resolution:** Implement + enable the three compliance topics with HMAC-verified handlers before any public-submission milestone. Scheduled in M1 (compliance) but handlers scaffolded early so the fast-ack→enqueue pattern is uniform.

### C-7 — "Repeat forever / implement everything" vs finite, verifiable increments
**Resolution:** Build in **thin vertical + foundational horizontal slices**, each compiling and non-breaking, tracked in the roadmap (`01_ROADMAP.md`) and TodoWrite. "Done" per increment = compiles (`typecheck`), lints, doesn't break dev, matches the relevant doc's acceptance criteria. Environment limits (no running Postgres/Redis/provider keys, sandboxed shell) mean some steps are *prepared + documented for the user to run*; those are explicitly flagged, never silently claimed as executed.

## 4. Target architecture on the real stack

Modular monolith (doc 20), web + worker from one image (doc 37), built inside the existing RR7 app:

```
app/
  routes/                # RR7 routes (thin: auth+validate+read/enqueue)  [extends existing]
  components/            # React wrappers over s-* web components (doc 13, per C-1)
  lib/
    config/              # validated env (doc 37)                         [M0.T3]
    errors/              # error taxonomy + AppError (docs 19/40)         [M0.T1]
    telemetry/           # structured logger, traceId, PII scrub (41)     [M0.T2]
    ids/                 # id + traceId generation                        [M0.T4]
    security/            # tenant guard, authz gates (docs 26/32)         [M0.T4]
    db/                  # prisma client + repositories (doc 18)          [M0.T7+]
    queue/               # BullMQ queues/workers/schedulers (doc 17)      [M0.later]
    ai/                  # provider abstraction, MCP, prompts, budgets    [M0.later]
    agents/
      types.ts           # TrustLevel, AgentId, AgentSpec, ToolSpec (16)  [M0.T5]
      runtime/ policy/ orchestrator/ tools/ specs/                        [M1]
    domain/
      shop/ scan/ findings/ actions/ automation/ billing/
      analytics/ memory/ notifications/                                   [M1+]
workers/                 # worker entrypoint (BullMQ)                     [M0.later]
prisma/                  # schema + migrations (Postgres after C-2)       [M0.T7]
```

Foundation-first because every domain/agent module imports `errors`, `telemetry`, `ids`, `security`, `config`, and the agent contracts. Building these first with zero new deps is the safe, correct base.

## 5. Architecture improvements over the docs (found during grounding)

- **Single `Result`/error-envelope + `AppError` taxonomy** (doc 19 codes) implemented as real code so every route/job/tool returns consistent, user-safe, PII-free errors — enforced, not aspirational.
- **`traceId` threaded from the first line** (doc 39) via an async-context-free explicit-pass pattern (RR7 has no global request context) — simpler + testable than AsyncLocalStorage for our shape; ALS can be layered later if needed.
- **Tenant guard as a typed brand** (`ShopScoped<T>`) so it's a *compile-time* error to run an unscoped shop query — stronger than the docs' "always filter by shop" prose (doc 32).
- **Polaris-web-component wrappers** give us the doc-13 state matrix (empty/loading/error) without a second UI framework.

## 6. Definition of Done (per increment) — from `00_MASTER_PROMPT.md`
- [ ] `npm run typecheck` clean, `npm run lint` clean.
- [ ] Does not break `npm run dev` (no imports of uninstalled packages; no breaking DB change without the docker path).
- [ ] Matches the acceptance criteria of the governing doc.
- [ ] Any store mutation is audited + reversible-or-gated (docs 00/40/41) — enforced once the pipeline lands.
- [ ] No TODO/placeholder/dead code.
- [ ] Docs/roadmap updated; ADR logged if a decision was made.

## 7. Environment limitations (honest)
This build environment has: a flaky/sandboxed shell classifier (Bash intermittently blocked), no running Postgres/Redis, no AI provider keys, and cannot execute `docker compose`, `prisma migrate`, or `npm install` reliably. Therefore:
- Code that compiles with **current deps** is written and verified via `typecheck` where the shell permits.
- Steps needing new deps/services (DB cutover, queues, providers) are produced as **complete, runnable artifacts + runbook**, and flagged as "run this" rather than reported as executed. Nothing is faked.
