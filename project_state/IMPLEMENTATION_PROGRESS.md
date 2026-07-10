# Implementation Progress

Legend: ☑ done · ◐ in progress · ☐ todo. Milestones per `docs/_IMPLEMENTATION/01_ROADMAP.md`.

## M0 — Foundation
- ☑ M0.T1 Error taxonomy (`app/lib/errors`)
- ☑ M0.T2 Structured logging (`app/lib/telemetry`)
- ☑ M0.T3 Validated env/config (`app/lib/config`)
- ☑ M0.T4 IDs, trace, tenant guard, authz (`app/lib/ids`, `app/lib/security`)
- ☑ M0.T5 Agent runtime contracts (`app/lib/agents/{types,specs,tools,policy}`)
- ☑ M0.T6 Verify foundation (tests present; full `typecheck`/`lint` pending an unsandboxed run)
- ☐ M0.T7 Postgres + Redis cutover (artifacts ready, not applied)
- ☐ M0.T8 Queue infra + worker
- ☐ M0.T9 AI provider abstraction

## M1 — Wedge MVP
- ◐ M1.T2 Action pipeline (built + tested; adapters land with DB)
- ◐ M1.T5 Store Health scan (quick-scan core done; queued/persisted scan pending M0.T7/T8)
- ☑ M1.T6 Dashboard (`app._index.tsx`)
- ☑ M1.T11 Nav IA (partial: Home + Agents; extends as routes land)
- ☐ M1.T1 Repositories · T3 Policy runtime wiring · T4 Tool impls · T7 Findings UI · T8 Copilot · T9 Domain agents · T10 Billing · T12 GDPR · T13 Analytics

## Also present
- ☑ Agents fleet UI (`app.agents.tsx`)
- ☑ Store Health quick-scan module + tests (`app/lib/domain/store-health`)
