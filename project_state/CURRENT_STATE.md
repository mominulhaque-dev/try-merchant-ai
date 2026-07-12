# Current State

> Read this FIRST each session. Short by design. Detail lives in `/docs/_IMPLEMENTATION`.

**Product:** TryMerchantAI — AI Commerce OS for Shopify. Existing embedded app (React Router 7 + Polaris web components + Prisma). Extend only; never re-init.

**Stack in repo now:** RR7 `flatRoutes`, Polaris **web components** (`s-*`) + App Bridge, `authenticate.admin`, Admin API `2025-10`. DB is still **SQLite** (Postgres cutover prepared, not applied).

## Built & verified
- **M0 foundation** (`app/lib`): `errors` (AppError + Result), `telemetry` (scrubbing JSON logger), `config` (validated env), `ids`, `security` (tenant guard + four-gate authz), `domain/enums`.
- **Agent contracts** (`app/lib/agents`): `types`, `specs` (all 12 agents), `tools` catalog, deterministic `policy` — all unit-tested.
- **Action pipeline** (`action-pipeline.server.ts`, M1.T2): reversibility spine, ports-and-adapters, tested. Now driven end-to-end by real in-memory adapters (`app/lib/agents/adapters/in-memory.server.ts`).
- **Store Health quick scan** (`app/lib/domain/store-health`): pure `scoreSnapshot` + `captureStoreSnapshot` (Admin GraphQL), unit-tested. Plus a pure **fix registry** (`fix.ts`) + **Fix-it wiring** (`fix.server.ts`, simulated executor) — tested.
- **AI provider abstraction** (`app/lib/ai`, M0.T9): vendor-neutral `AIProvider` port; Anthropic adapter (official `@anthropic-ai/sdk` — adaptive thinking, effort, structured output, streaming) + OpenAI adapter (Chat Completions via `fetch`); `AIService` does tier resolution (primary→fallback→cheap), automatic failover, per-shop AAC budget guard + metering — unit-tested with a fake provider.
- **Copilot chat** (`app.copilot.tsx` + `app/lib/ai/copilot.server.ts`, M1.T8): streaming SSE conversational surface grounded in the live Store-Health scan, wired to `AIService` (tiering/failover/AAC metering). Pure grounding/prompt/suggestion/SSE builders + streaming orchestration are unit-tested with a fake provider; no store writes from chat (writes stay on Findings; model tool exposure deferred to M1.T4).
- **UI:** Dashboard (`app._index.tsx`) with first-run/healthy/steady/error states + live scan; **Copilot** (`app.copilot.tsx`) streaming chat; **Findings** (`app.findings.tsx`) driving preview→approve→execute→undo per fixable finding with an audit-activity aside; `app.agents.tsx` fleet view. Nav = Home + Copilot + Findings + Agents.

## Not yet built
- M0.T7 Postgres+Redis cutover (artifacts ready in `docs/_IMPLEMENTATION/02_DB_CUTOVER.md`; run when Docker available) — makes fix state/audit/budget durable.
- M0.T8 queues/worker. M0.T9 AI abstraction is built; its live-API path is unexercised (no API keys here) and MCP tool exposure lands with M1.T4.
- M1.T4 real Shopify fix executor (findings enriched with product refs; performs + truly reverses writes), repositories, persisted scans, billing, GDPR webhooks. Copilot chat is built (M1.T8) but the live model path is unexercised (no API key here) and it exposes no write tools to the model yet (deferred to M1.T4).
- Public landing (`_index/route.tsx`) still has template placeholder copy.

## Environment note
`npm run typecheck` and `npm run test` run green in this session; `npm run lint` is blocked by a native-addon ABI issue (see KNOWN_ISSUES), not code. Docker/Postgres unavailable, so DB-dependent steps remain runbook artifacts. Nothing is faked.
