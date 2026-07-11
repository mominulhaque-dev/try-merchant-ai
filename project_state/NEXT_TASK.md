# Next Task

**M0.T7 — Postgres + Redis cutover** (docs/_IMPLEMENTATION/02_DB_CUTOVER.md), when Docker is available.

Why next: every persistent feature (repositories, persisted scans → history, findings storage, billing, chat, audit) is blocked on it. Artifacts are ready (`docker-compose.yml`, `.env.example`, target schema). Steps: `docker compose up -d` → swap `schema.prisma` to Postgres → retire SQLite migration → `prisma migrate dev --name init` → `npm run typecheck` → `npm run dev`.

If Docker is unavailable, the best non-blocked increment is:

**M0.T9 — AI provider abstraction** (Anthropic/OpenAI, structured + streaming, failover per `AgentSpec.model`, token/AAC metering hooks). No Docker needed; it unblocks the Copilot chat and the real content/SEO drafting that the Fix-it `SimulatedFixExecutor` will call once the Shopify write adapter lands. Prefer the latest Claude models (Opus 4.8 / Sonnet 5 / Haiku 4.5) as defaults.

(M1.T7 Findings UI + Fix-it loop is now done — see ACTIVE_TASK.)
