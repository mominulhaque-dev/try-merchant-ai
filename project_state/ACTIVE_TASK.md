# Active Task

**M1.T8 — Copilot chat (streaming)** (docs/15 "AI Chat (Copilot)"). ✅ Done this session (Docker still unavailable, so this was the next non-blocked increment; it exercises the M0.T9 AI abstraction end-to-end).

A streaming, grounded conversational surface, wired to the vendor-neutral `AIService`:

- `app/lib/ai/copilot.server.ts` — composed `AIService` singleton (`getCopilotService`) over the configured providers, plus a per-shop in-memory AAC meter (`InMemoryCopilotBudget`). Pure, unit-testable builders: `groundingContext` (renders the live scan into a fenced block, flagging merchant text as untrusted data — injection defense), `buildCopilotSystemPrompt` (store-health charter + copilot notes + grounding), `suggestedPrompts` (derived from findings), `encodeSSE`, and `clampHistory` (bounds untrusted client history). `streamCopilotReply` assembles the request and delegates streaming to the service (injectable for tests).
- `app/routes/app.copilot.tsx` — `loader` grounds via the live quick scan and returns suggestions + provider status; `action` returns a Server-Sent-Events `ReadableStream` driven by `streamCopilotReply` (token/done/error events). `s-*` chat UI streams tokens via raw `fetch` (App Bridge auto-auth) + an `AbortController` "Stop"; empty state offers suggested prompts; degraded/no-provider and scan-error banners (docs/40); `aria-live` transcript for a11y. No write tools are exposed to the model — fixes stay on the Findings page.
- Wired Copilot into the app nav (`app.tsx`) and added a dashboard quick-entry (`app._index.tsx`).

**Verification (ran this session):** `npm run typecheck` ✅ · `npm run test` ✅ (88 tests, 11 files — 11 new Copilot tests: grounding, prompt assembly, suggestions, SSE encoding, history clamping, streaming + budget-block via a fake provider) · `npm run build` ✅. `npm run lint` still env-blocked (native TS import-resolver addon — repo-wide, not code). No live model call was made (no API keys in this env); the streaming path is validated with a fake provider.
