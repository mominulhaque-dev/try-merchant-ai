# Next Task

**M0.T7 — Postgres + Redis cutover** (docs/_IMPLEMENTATION/02_DB_CUTOVER.md), when Docker is available.

Why next: every persistent feature (repositories, persisted scans → history, findings storage, billing, chat, audit) is blocked on it. Artifacts are ready (`docker-compose.yml`, `.env.example`, target schema). Steps: `docker compose up -d` → swap `schema.prisma` to Postgres → retire SQLite migration → `prisma migrate dev --name init` → `npm run typecheck` → `npm run dev`.

If Docker is unavailable, the best non-blocked increment is:

**M1.T7 — Findings UI + persistence-ready detail** and wiring the dashboard "Fix it" into the existing action pipeline (`app/lib/agents/action-pipeline.server.ts`) with in-memory adapters, so the reversible preview→approve→execute→undo loop is exercised end-to-end before the DB lands.
