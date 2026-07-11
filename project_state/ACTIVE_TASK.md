# Active Task

**M0.T9 — AI provider abstraction** (docs/16 "Model provider abstraction", ADR-016-2). ✅ Done this session (Docker unavailable, so this was the next non-blocked increment).

A uniform, vendor-neutral interface over model providers, in `app/lib/ai`:

- `types.ts` — the `AIProvider` port + `CompletionRequest`/`CompletionResult`/`CompletionChunk`, `ChatMessage`, `JsonSchema`, `Effort`, model tiers. No vendor types leak out.
- `providers/anthropic.server.ts` — real adapter on the official `@anthropic-ai/sdk` (added dep): adaptive thinking, `output_config.effort`, structured output via `output_config.format`, streaming, normalized usage/stop-reason. No `temperature`/`budget_tokens` (rejected on Opus 4.8).
- `providers/openai.server.ts` — fallback adapter on the Chat Completions REST API via `fetch` (no extra dep), same port, streaming with `include_usage`.
- `service.server.ts` — `AIService`: resolves `AgentSpec.model` tiers (primary→fallback→cheap), automatic cross-provider failover on retryable outages, per-shop AAC budget `ensure`/`consume` + metering (`usageToAAC`).
- `errors.server.ts` — maps provider/HTTP/abort failures to the AppError taxonomy with correct `retryable` flags (drives failover).
- `factory.server.ts` — builds the provider set from validated env (a provider is included only when its key is present).
- Refreshed the agent primary model default to `claude-sonnet-5` (`specs.ts`).

**Verification (ran this session):** `npm run typecheck` ✅ · `npm run test` ✅ (72 tests, 9 files — 18 new AI tests: failover, budget block, tiering, structured output, streaming, error mapping, all with a fake provider) · `npm run build` ✅. `npm run lint` still env-blocked (native TS import-resolver addon can't load on this Windows box — repo-wide, not code); AI files reviewed by hand. No live model call was made (no API keys in this env).
