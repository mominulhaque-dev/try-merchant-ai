# Active Task

**M1.T7 — Findings UI + Fix-it wired to the action pipeline** (docs/07 F-02, docs/14, docs/16). ✅ Done this session.

Wired the reversibility spine end-to-end behind real in-memory adapters, before the DB cutover:

- `app/lib/agents/adapters/in-memory.server.ts` — real `InMemoryActionStore`, `InMemoryAuditLog`, `KeyedMutexLock` (per-key single-writer), `InMemoryBudget`. Process-lifetime, tenant-isolated, unit-tested.
- `app/lib/domain/store-health/fix.ts` — pure fix registry mapping a `HealthFinding` → typed, gated, reversible `ActionProposal` + deterministic diff + tool-catalog requirement (advisory findings return null).
- `app/lib/domain/store-health/fix.server.ts` — composes the pipeline with the in-memory adapters + a `SimulatedFixExecutor` (drafts/records, no live write yet); exposes `previewFinding`/`executeFinding`/`undoFinding` + UI read helpers.
- `app/lib/security/entitlements.server.ts` — real granted scopes from the session; documented pre-billing plan/role defaults.
- `app/routes/app.findings.tsx` — preview → approve → execute → undo per fixable finding, advisory list, recent-activity audit aside. Dashboard + nav link to it.

**Verification (ran this session):** `npm run typecheck` ✅ · `npm run test` ✅ (54 tests, 7 files). `npm run lint` is env-blocked (`ERR_DLOPEN_FAILED` in the TS import-resolver native addon — Node-ABI/MSVC issue, not code); manual review done against the ESLint config. Fixed `tsconfig.json` (`ignoreDeprecations` "6.0"→"5.0", removed unused deprecated `baseUrl`) which had been breaking `npm run typecheck`.
