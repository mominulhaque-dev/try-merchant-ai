# Next Task

**M0.T7 — Postgres + Redis cutover** (docs/_IMPLEMENTATION/02_DB_CUTOVER.md), when Docker is available.

Why next: every persistent feature (repositories, persisted scans → history, findings storage, billing, chat, audit, durable AAC budget) is blocked on it. Artifacts are ready (`docker-compose.yml`, `.env.example`, target schema). Steps: `docker compose up -d` → swap `schema.prisma` to Postgres → retire SQLite migration → `prisma migrate dev --name init` → `npm run typecheck` → `npm run dev`.

If Docker is unavailable, the best non-blocked increment is:

**M1.T8 — Copilot chat (streaming)**: a streaming chat route + `s-*` chat UI grounded in Store-Health findings, wired to the new `AIService` (`app/lib/ai`) via the cheap/primary tiers. It exercises the AI abstraction end-to-end (streaming, tiering, budget metering), needs no DB (grounding comes from the live quick scan), and only needs an `ANTHROPIC_API_KEY` in `.env` to run against a real model (docs/15/16/31).

(M0.T9 AI provider abstraction is now built — see ACTIVE_TASK. M1.T7 Findings + Fix-it loop done before it.)
