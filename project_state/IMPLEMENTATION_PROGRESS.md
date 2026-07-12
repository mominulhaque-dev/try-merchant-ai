# Implementation Progress

Legend: ☑ done · ◐ in progress · ☐ todo. Milestones per `docs/_IMPLEMENTATION/01_ROADMAP.md`.

## M0 — Foundation
- ☑ M0.T1 Error taxonomy (`app/lib/errors`)
- ☑ M0.T2 Structured logging (`app/lib/telemetry`)
- ☑ M0.T3 Validated env/config (`app/lib/config`)
- ☑ M0.T4 IDs, trace, tenant guard, authz (`app/lib/ids`, `app/lib/security`)
- ☑ M0.T5 Agent runtime contracts (`app/lib/agents/{types,specs,tools,policy}`)
- ☑ M0.T6 Verify foundation (`typecheck` + `test` now run green; `lint` env-blocked by a native-addon ABI issue)
- ☐ M0.T7 Postgres + Redis cutover (artifacts ready, not applied)
- ☐ M0.T8 Queue infra + worker
- ◐ M0.T9 AI provider abstraction (`app/lib/ai`): vendor-neutral port, Anthropic (SDK) + OpenAI (fetch) adapters, tiering + failover + AAC metering + budget guard — tested, and now exercised end-to-end by the Copilot (M1.T8). OpenAI adapter untested vs a live endpoint; live model path needs an API key; MCP tool exposure lands with M1.T4.

## M1 — Wedge MVP
- ◐ M1.T2 Action pipeline (built + tested; real in-memory adapters live, Prisma/Shopify adapters land with DB)
- ◐ M1.T5 Store Health scan (quick-scan core done; queued/persisted scan pending M0.T7/T8)
- ☑ M1.T6 Dashboard (`app._index.tsx`)
- ☑ M1.T7 Findings UI + Fix-it loop (`app.findings.tsx`) wired to the pipeline via in-memory adapters (preview→approve→execute→undo). Shopify write executor pending.
- ☑ M1.T8 Copilot chat (`app.copilot.tsx` + `app/lib/ai/copilot.server.ts`): streaming SSE replies grounded in the live Store-Health scan, wired to `AIService` (tiering/failover/AAC metering); degraded-mode + no-provider fallbacks; writes stay on Findings. Model tool exposure deferred to M1.T4; live path needs an API key.
- ☑ M1.T11 Nav IA (Home + Copilot + Findings + Agents; extends as routes land)
- ☑ M1.T12 GDPR/compliance webhooks (`webhooks.customers.data_request|redact`, `webhooks.shop.redact`) + `compliance_topics` in toml; port-based, HMAC-verified, audited, retry-on-500. No customer PII stored → customer handlers are honest acks; shop/redact deletes sessions.
- ☐ M1.T1 Repositories · T3 Policy runtime wiring · T4 Tool impls (real Shopify executor) · T9 Domain agents · T10 Billing · T13 Analytics

## Also present
- ☑ Agents fleet UI (`app.agents.tsx`)
- ☑ Store Health quick-scan module + tests (`app/lib/domain/store-health`)
- ☑ In-memory action-pipeline adapters + fix registry + tests (`app/lib/agents/adapters`, `app/lib/domain/store-health/fix*`)
- ◐ AI provider abstraction (`app/lib/ai`): types/port, error mapping, Anthropic + OpenAI adapters, `AIService` (failover/tiering/metering) + tests
