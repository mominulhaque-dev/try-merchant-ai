# 15 — AI Chat (Copilot) Specification

## Purpose
Specify the Copilot: the conversational surface where merchants ask about their store and act on answers. Covers UX, the request/response protocol, grounding, tool-use, streaming, safety, and cost.

## Goals
- Grounded, cited answers over live store data + memory (`31`).
- Seamless "ask → act" via the reversible action pipeline (`07` F-02).
- Safe (injection-resistant, approval-gated), fast (streaming), and cost-bounded.

## Surface & UX (`11`,`13`)
- Route `app/routes/app.copilot.tsx`; also a quick-entry from Dashboard.
- Empty state: suggested prompts derived from current findings ("Fix my top SEO issue", "Why did sales drop this week?").
- Streaming responses with visible **agent/tool activity** ("Reading products… drafting titles…"), stop-generation, and citations of data used.
- Actionable answers render `ActionPreview` cards → approve → execute → undo.
- Degraded mode banner on provider outage → Suggest-only from cached context (`40`).
- Threads persisted; renamable; per-shop isolated.

## Conversation model
- **Session** = a thread; **Message** = user/assistant/system/tool; **ToolCall** = typed invocation + result. Persisted in `18`.
- Context window assembled per turn from: system prompt (agent/orchestrator), relevant memory (`31`), retrieved store facts (RAG over catalog/orders/settings), recent turns (summarized when long), and the tool catalog available to the current plan/scopes.

## Orchestration
The Copilot is backed by the **Orchestrator** (`16`): it classifies intent, routes to the right agent(s), and composes a response. Simple Q&A may be answered directly; action requests route to the owning agent's tools. Multi-domain asks fan out and merge (with a single-writer discipline for any writes).

## Request/response protocol (internal)
- Endpoint: `POST /api/copilot/stream` (SSE/streamed response, `19`,`21`). Auth via session token (`25`).
- Request: `{ sessionId, message, context?: {route, selectedResource?} }`.
- Server: authenticate → load session + memory → assemble context → call model with tool schemas → stream tokens + tool-call events → persist → return citations + any action offers.
- Events streamed: `token`, `tool_call` (name/args/status), `tool_result` (summary only, no raw PII), `action_offer` (typed action), `citation`, `done`, `error`.

## Tool-use (typed, gated)
- The model may only call tools in the current agent's **allowlist** (`16`,`19`). Tools are typed (JSON schema), validated server-side.
- **Read tools** (get products, orders summary, analytics) can run without approval (rate-limited, PII-minimized).
- **Write tools** never execute from chat directly — they produce an `action_offer` that goes through preview→approve→execute→audit→undo (`07` F-02). No exceptions at MVP.
- Tool results feed back into the model for a grounded final answer.

## Grounding & citations
- Retrieval: structured queries (Admin GraphQL/our DB) + semantic memory (`31`). Prefer authoritative structured data over model recall.
- Every factual claim about the store cites its source (which query/finding). "As of" timestamps for freshness.
- If data is missing/uncertain, say so — never fabricate store facts.

## Safety (`32`)
- **Prompt-injection defense:** store content (product text, customer messages) is untrusted input. It is clearly delimited, never elevated to instructions; tools remain allowlisted; a policy layer blocks tool calls that violate scope/autonomy regardless of model output.
- **PII minimization:** de-identify customer data before sending to providers where feasible; never stream raw PII to the client beyond what the merchant already sees in Admin.
- **Refusals:** out-of-scope, unsafe, or cross-tenant requests refused + redirected. Cross-tenant access is impossible by construction (shop-scoped context + queries).
- **Output validation:** action args validated against schema + business rules before any execution offer.

## Cost & performance (`00` P7)
- **Model tiering:** cheap/fast model for classification, retrieval formatting, and simple Q&A; frontier model (Claude primary) for reasoning/planning/writes. Route by intent complexity.
- **Budgets:** per-turn token cap, per-session cap, per-shop daily AAC budget (`27` metering). Exceeding budget → graceful message + upsell, never silent overrun.
- **Caching:** cache embeddings, retrieval results, and repeated system context; prompt-cache where provider supports it.
- **Latency:** stream first token fast; do retrieval in parallel; target time-to-first-token within `33` budget.

## Persistence & memory (`31`)
- Durable facts learned in chat (preferences, store context) written to structured memory; transient chat kept per session; summaries roll up long threads. Merchant can view/edit what the Copilot "knows."

## Multilingual
Respond in the merchant's Admin locale where possible; store content handled in its own language (`34`,`50`).

## Edge cases
- Ambiguous request → ask one clarifying question, don't guess a write.
- Provider outage/timeouts → degrade to Suggest-only + cached; retries with backoff; no lost session (`40`).
- Very long thread → summarize + truncate safely, preserve key facts in memory.
- Conflicting simultaneous actions → single-writer lock + reconcile (`16`).
- Merchant asks it to do something beyond plan/scope → explain gate + offer upgrade/authorize (`26`,`27`).
- Rate limits (Shopify or provider) → backoff, queue, inform (`22`).

## Telemetry (`29`)
Turns, tokens/cost per turn, tool calls, action offers→approvals→executions, TTFT/latency, refusal rate, satisfaction (thumbs), degraded-mode incidence. Feeds cost control + quality.

## Testing (`36`)
Scenario suites (Q&A, action offers, refusals, injection attempts), streaming/interruption tests, tool-schema validation, budget-enforcement tests, a11y (live-region announcements, stop button), and cross-tenant isolation tests.

## Future expansion
Voice input, proactive Copilot (it messages the merchant when it spots something), multi-step plan approval ("here's a 5-step plan — approve all/step-by-step"), and agent-to-agent visible collaboration (`50`).

## Maintenance
Owned by AI Eng. Prompt/protocol changes versioned; tool allowlist changes reviewed by Security. Keep in sync with `16` orchestrator + `19` endpoints.
