# Current State

> Read this FIRST each session. Short by design. Detail lives in `/docs/_IMPLEMENTATION`.

**Product:** TryMerchantAI — AI Commerce OS for Shopify. Existing embedded app (React Router 7 + Polaris web components + Prisma). Extend only; never re-init.

**Stack in repo now:** RR7 `flatRoutes`, Polaris **web components** (`s-*`) + App Bridge, `authenticate.admin`, Admin API `2025-10`. DB is still **SQLite** (Postgres cutover prepared, not applied).

## Built & verified
- **M0 foundation** (`app/lib`): `errors` (AppError + Result), `telemetry` (scrubbing JSON logger), `config` (validated env), `ids`, `security` (tenant guard + four-gate authz), `domain/enums`.
- **Agent contracts** (`app/lib/agents`): `types`, `specs` (all 12 agents), `tools` catalog, deterministic `policy` — all unit-tested.
- **Action pipeline** (`action-pipeline.server.ts`, M1.T2): reversibility spine, ports-and-adapters, tested. Now driven end-to-end by real in-memory adapters (`app/lib/agents/adapters/in-memory.server.ts`).
- **Store Health quick scan** (`app/lib/domain/store-health`): pure `scoreSnapshot` + `captureStoreSnapshot` (Admin GraphQL), unit-tested. Plus a pure **fix registry** (`fix.ts`) + **Fix-it wiring** (`fix.server.ts`, simulated executor) — tested.
- **UI:** Dashboard (`app._index.tsx`) with first-run/healthy/steady/error states + live scan; **Findings** (`app.findings.tsx`) driving preview→approve→execute→undo per fixable finding with an audit-activity aside; `app.agents.tsx` fleet view. Nav = Home + Findings + Agents.

## Not yet built
- M0.T7 Postgres+Redis cutover (artifacts ready in `docs/_IMPLEMENTATION/02_DB_CUTOVER.md`; run when Docker available) — makes fix state/audit/budget durable.
- M0.T8 queues/worker, M0.T9 AI provider abstraction.
- M1.T4 real Shopify fix executor (findings enriched with product refs; performs + truly reverses writes), repositories, persisted scans, Copilot chat, billing, GDPR webhooks.
- Public landing (`_index/route.tsx`) still has template placeholder copy.

## Environment note
`npm run typecheck` and `npm run test` run green in this session; `npm run lint` is blocked by a native-addon ABI issue (see KNOWN_ISSUES), not code. Docker/Postgres unavailable, so DB-dependent steps remain runbook artifacts. Nothing is faked.
