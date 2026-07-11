# Changelog (project_state)

> Terse, newest first. Full narrative history is in root `CHANGELOG.md`.

## 2026-07-11 (M0.T9)
- Added the AI provider abstraction (`app/lib/ai`, docs/16 ADR-016-2): vendor-neutral `AIProvider` port + `CompletionRequest/Result` contracts (`types.ts`).
- Anthropic adapter (`providers/anthropic.server.ts`) on the official `@anthropic-ai/sdk` (added dep): adaptive thinking, effort knob, structured output via `output_config.format`, streaming, normalized usage — no `temperature`/`budget_tokens` (rejected on Opus 4.8).
- OpenAI fallback adapter (`providers/openai.server.ts`) on the Chat Completions REST API via `fetch` (no extra dep), same port, streaming with usage.
- `AIService` (`service.server.ts`): resolves `AgentSpec.model` tiers (primary→fallback→cheap), automatic cross-provider failover on retryable outages, per-shop AAC budget guard + metering (`usageToAAC`). Provider errors normalized to the taxonomy (`errors.server.ts`).
- Config-driven provider factory (`factory.server.ts`); 18 unit tests (failover, budget block, tiering, structured output, streaming, error mapping) with a fake provider — no network.
- Refreshed agent primary model default `claude-sonnet-4-6` → `claude-sonnet-5` (`specs.ts`).

## 2026-07-11 (M1.T7)
- Added real in-memory action-pipeline adapters (`app/lib/agents/adapters/in-memory.server.ts`): tenant-isolated action store, bounded audit log, per-key single-writer mutex, per-shop AAC budget — with unit tests.
- Added the Store-Health fix registry (`app/lib/domain/store-health/fix.ts`): pure mapping of a finding → typed, gated, reversible action proposal + deterministic diff; advisory findings excluded.
- Wired the Fix-it loop (`app/lib/domain/store-health/fix.server.ts`): action pipeline + in-memory adapters + a simulated (no-live-write) Shopify executor; `previewFinding`/`executeFinding`/`undoFinding` + UI read helpers, unit-tested end-to-end.
- Added `app/routes/app.findings.tsx`: preview → approve → execute → undo per fixable finding, advisory list, recent-activity audit aside. Linked from the dashboard and app nav.
- Added `app/lib/security/entitlements.server.ts`: real granted scopes from the session; documented pre-billing plan/role defaults.
- Fixed `tsconfig.json`: `ignoreDeprecations` "6.0"→"5.0" and removed unused deprecated `baseUrl` — `npm run typecheck` was failing on the pinned TS 5.9.3 before this.

## 2026-07-11
- Added Store Health quick-scan module (`app/lib/domain/store-health`): pure, deterministic `scoreSnapshot` + read-only `captureStoreSnapshot` (Admin GraphQL, bounded sample), with unit tests.
- Replaced the Shopify template demo dashboard (`app/routes/app._index.tsx`) with a real Store Health dashboard: health score, ranked findings, first-run/healthy/error states, live "Run scan".
- Removed dead template route `app.additional.tsx`; trimmed app nav to real routes (Home, Agents).
- Created the mandated `/project_state` governance files (this set).
