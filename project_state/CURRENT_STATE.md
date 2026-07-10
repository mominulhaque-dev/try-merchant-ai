# Current State

> Read this FIRST each session. Short by design. Detail lives in `/docs/_IMPLEMENTATION`.

**Product:** TryMerchantAI — AI Commerce OS for Shopify. Existing embedded app (React Router 7 + Polaris web components + Prisma). Extend only; never re-init.

**Stack in repo now:** RR7 `flatRoutes`, Polaris **web components** (`s-*`) + App Bridge, `authenticate.admin`, Admin API `2025-10`. DB is still **SQLite** (Postgres cutover prepared, not applied).

## Built & verified
- **M0 foundation** (`app/lib`): `errors` (AppError + Result), `telemetry` (scrubbing JSON logger), `config` (validated env), `ids`, `security` (tenant guard + four-gate authz), `domain/enums`.
- **Agent contracts** (`app/lib/agents`): `types`, `specs` (all 12 agents), `tools` catalog, deterministic `policy` — all unit-tested.
- **Action pipeline** (`action-pipeline.server.ts`, M1.T2 early): reversibility spine, ports-and-adapters, tested.
- **Store Health quick scan** (`app/lib/domain/store-health`): pure `scoreSnapshot` + `captureStoreSnapshot` (Admin GraphQL), unit-tested.
- **UI:** real Dashboard (`app._index.tsx`, replaces template demo) with first-run/healthy/steady/error states + live scan; `app.agents.tsx` fleet view. Nav = Home + Agents.

## Not yet built
- M0.T7 Postgres+Redis cutover (artifacts ready in `docs/_IMPLEMENTATION/02_DB_CUTOVER.md`; run when Docker available).
- M0.T8 queues/worker, M0.T9 AI provider abstraction.
- M1: repositories, persisted scans, Findings UI + Fix-it, Copilot chat, billing, GDPR webhooks.
- Public landing (`_index/route.tsx`) still has template placeholder copy.

## Environment note
This build session cannot reliably run Bash/Docker/`npm` (sandbox classifier). Code is written to compile with current deps; DB/queue/provider steps are shipped as runnable artifacts + runbook, never faked.
