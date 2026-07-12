# Next Task

**M0.T7 — Postgres + Redis cutover** (docs/_IMPLEMENTATION/02_DB_CUTOVER.md), when Docker is available.

Why next: every persistent feature (repositories, persisted scans → history, findings storage, billing, chat thread persistence, durable AAC budget shared across agents + Copilot, audit) is blocked on it. Artifacts are ready (`docker-compose.yml`, `.env.example`, target schema). Steps: `docker compose up -d` → swap `schema.prisma` to Postgres → retire SQLite migration → `prisma migrate dev --name init` → `npm run typecheck` → `npm run dev`.

If Docker is unavailable, the best non-blocked increment is:

**M1.T9 (start) — Domain agent runtime over the tool catalog**, or extend the Copilot toward its full spec (docs/15): persist threads + surface `tool_call`/`action_offer` events once the tool catalog (M1.T4) exposes read tools to the model, and render inline `ActionPreview` cards that hand off to the Findings pipeline. Both remain blocked on either the DB (thread persistence, M0.T7) or the real tool catalog/executor (M1.T4) for their write path, so prefer M0.T7 as soon as Docker is present.

(M1.T8 Copilot chat is now built — see ACTIVE_TASK. It exercises the M0.T9 AI abstraction end-to-end; the live model path just needs an `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` in `.env`.)
