# 31 — AI Memory System

## Purpose
Define the persistent, per-shop memory that lets agents compound context — so the product feels smarter every week and never re-asks what it already learned. Memory is a core moat + switching cost (`01`,`02`).

## Goals
- Durable, structured + semantic memory scoped per shop (and per agent).
- Grounded, retrievable, editable, privacy-safe memory.
- Bounded cost + no stale/contradictory memory.

## Memory taxonomy
1. **Structured facts** — store profile, brand voice/tone, category, target audience, preferences ("always keep titles under 60 chars"), integrations, goals. Authoritative, queryable.
2. **Baselines** — metric baselines per domain (conversion, SEO positions, inventory velocity) for anomaly detection + MAVD (`29`).
3. **Episodic memory** — past findings, actions, outcomes, decisions ("merchant dismissed X because Y"). Prevents repeating rejected suggestions.
4. **Semantic memory (vector)** — embeddings of catalog content, policies, past conversations, brand docs for retrieval-augmented grounding (`15`).
5. **Summaries** — rolled-up long chat threads + long histories to fit context windows.

## Storage
- **Structured/episodic/baselines:** Postgres (`MemoryItem` + domain tables, `18`).
- **Semantic:** `pgvector` (embeddings on `MemoryItem`) or managed vector store; namespaced by `shop` + `scope`.
- **Cache:** hot memory in Redis for fast agent context assembly.
- Scoping: `MemoryScope` = `shop` (shared across agents) or `agentId` (agent-private). Shared memory prevents agents contradicting each other (`16`).

## Read path (context assembly)
```
Agent task / chat turn →
  load structured facts (shop + agent scope) +
  retrieve top-K semantic memories (embed query → vector search, filtered by shop) +
  relevant baselines + recent episodic +
  summaries (for long history)
  → assemble within token budget (16) → prompt
```
- **Retrieval is shop-filtered always** (tenant isolation, `32`). Relevance-ranked; deduped; budget-capped.
- Prefer authoritative structured facts over fuzzy recall; cite sources (`15`).

## Write path (learning)
- Agents/Copilot propose memory writes (new fact, updated preference, outcome). Writes go through validation + dedup + conflict resolution before persisting.
- **Provenance:** every memory records source (which chat/action/scan) + timestamp + confidence.
- **Consolidation jobs** (`17`): periodically summarize episodic → durable facts, decay stale memories, resolve contradictions.

## Consistency & freshness
- **Conflict resolution:** newer/higher-confidence facts supersede; contradictions flagged for consolidation or merchant confirmation.
- **Decay/TTL:** low-value or old episodic memory decays; baselines refresh on schedule; catalog embeddings re-indexed on product webhooks (`24`).
- **No stale authority:** facts have "as of"; agents treat old baselines cautiously.

## Merchant control & transparency (`00` P1)
- Merchant can **view, edit, and delete** what an agent "knows" (Agents → memory view, `10`). Builds trust; also GDPR-relevant.
- Corrections are high-confidence writes that override inferred memory.

## Privacy & security (`32`,`44`)
- **Tenant isolation:** memory is shop-scoped; retrieval filtered by shop; impossible to retrieve another shop's memory by construction.
- **PII minimization:** avoid storing customer PII in memory; where unavoidable, minimize + encrypt + include in redaction flows (`24`).
- **Provider exposure:** only send necessary, de-identified memory to model providers; no secrets ever.
- **Redaction:** `customers/redact`/`shop/redact` purge relevant memory (`24`).
- **Injection safety:** memory content is untrusted-ish (may include store text); delimited, never elevated to instructions; policy layer authoritative (`15`,`16`).

## Cost control (`00` P7)
- Embedding + retrieval cached; K bounded; summaries reduce token load; memory writes deduped. Memory ops metered into AAC where material.

## Scalability
- Vector index per shop namespace; partitioned; incremental re-indexing on content change; retrieval latency budget (`33`). Scales to large catalogs by embedding representative/aggregate content, not every field redundantly.

## Edge cases
- Contradictory facts → conflict resolution + optional merchant confirm.
- Stale baseline after a store pivot → decay + re-baseline; anomaly detection tolerant of regime change.
- Huge catalog → embed selectively (titles/descriptions/collections), aggregate, not exhaustive.
- Merchant edits memory to something wrong → respected but flagged if it causes agent errors.
- Redaction removes memory an agent relied on → agent degrades gracefully, re-learns.
- Vector store outage → fall back to structured facts + recent context; degrade, don't fail (`40`).

## Testing (`36`)
- Retrieval relevance tests (golden queries), tenant-isolation tests (no cross-shop retrieval), conflict-resolution tests, decay/consolidation tests, redaction tests (memory purged), injection tests (memory content can't hijack tools), and budget-bound tests.

## Future expansion
Cross-store learning at the *model/prioritization* level (aggregated, anonymized — never raw cross-tenant retrieval), long-term goal memory ("we're pushing subscriptions this quarter"), and shared agency playbook memory (`50`).

## Decisions (ADR)
- **ADR-031-1:** Memory is strictly shop-scoped; retrieval always shop-filtered (hard tenant isolation).
- **ADR-031-2:** Structured facts outrank fuzzy recall; every memory has provenance + confidence + "as of."
- **ADR-031-3:** Merchants can view/edit/delete agent memory; redaction purges it.

## Maintenance
Owned by AI Architect. New memory kinds define scope, write validation, decay policy, retrieval use, and redaction handling. Monitor retrieval quality + memory growth; consolidation jobs tuned continuously.
