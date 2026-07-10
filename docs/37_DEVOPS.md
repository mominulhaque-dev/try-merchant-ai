# 37 — DevOps

## Purpose
Define CI/CD, infrastructure-as-code, environments, and the developer workflow that gets code from commit to production safely and repeatably.

## Goals
- Fully automated, gated CI/CD.
- Reproducible infra (Docker + IaC) across environments.
- Fast, safe deploys with rollback (`38`).

## Ground truth
- `package.json` scripts: `build` (react-router build), `dev` (shopify app dev), `deploy` (shopify app deploy), `setup` (prisma generate + migrate deploy), `docker-start`, `lint`, `typecheck`, `graphql-codegen`. Node `>=20.19 <22 || >=22.12`, ESM. Cloudflare tunnel plugin trusted. Workspaces for `extensions/*`.
- No CI/infra defined yet — net-new.

## Environments
| Env | Purpose | Data | Shopify |
|---|---|---|---|
| Local | Dev | SQLite/local PG + local Redis | `shopify app dev` + Cloudflare tunnel |
| CI | Test | ephemeral PG/Redis (containers) | mocked + dev store for e2e |
| Staging | Pre-prod, App-review-like | isolated PG/Redis | staging Shopify app + dev/test stores |
| Production | Live | managed PG + Redis | production Shopify app |
- **Config parity** (12-factor): identical images, env-only differences. Secrets per env in a secret manager (`32`).

## Source control & workflow (`49`)
- GitHub; trunk-based with short-lived feature branches + PRs.
- Branch protection: required checks (typecheck, lint, tests, a11y, security, build) + review before merge to `main`.
- Conventional Commits → automated changelog + semver (`49`).
- No direct pushes to `main`; no merge with red checks.

## CI pipeline (GitHub Actions)
On PR:
1. Install (cached), `graphql-codegen`, `react-router typegen`.
2. `typecheck` + `lint`.
3. Unit + integration (spin PG + Redis service containers).
4. A11y checks (`34`), AI safety suite (`36`), contract tests.
5. Build (`react-router build`) + bundle-size/perf budget check (`33`).
6. SCA/SAST + secret scanning (`32`).
On merge to `main`:
7. Full e2e (Playwright vs. dev store), load smoke.
8. Build + push Docker images (web + worker).
9. Deploy to staging → smoke → (gated) promote to production (`38`).
10. `shopify app deploy` to push app config/extensions (versioned).

## Containerization (Docker)
- Multi-stage Dockerfile: build stage (deps + build) → slim runtime (non-root, minimal base). ESM Node 22.
- **Two services** from shared image: **web** (`react-router-serve`) and **worker** (BullMQ processors) — same code, different entrypoint (`17`,`20`).
- `setup` (prisma generate + migrate deploy) runs on release (migrations gated, `18`).
- No secrets in images; config via env at runtime; healthcheck endpoints.

## Infrastructure as Code
- IaC (Terraform or platform config) for: app services (web/worker), managed **Postgres**, managed **Redis**, object storage, secret manager, Cloudflare (DNS/CDN/WAF), monitoring. Reviewed like code; no click-ops in prod.
- Hosting: container platform (Fly.io / Render / Railway / AWS ECS — pick one, document) with autoscaling; Cloudflare in front (`38`).

## Secrets & config (`32`)
- Secret manager per env (`SHOPIFY_API_SECRET`, provider keys, `DATABASE_URL`, `REDIS_URL`, ESP keys). Rotation policy. Never in repo/images/logs. `.env` only local (gitignored).

## Dependency management
- Lockfile committed; Dependabot/Renovate for updates; SCA gate; pin critical deps; review before major bumps (esp. Shopify libs, RR7, Prisma). `trustedDependencies`/`overrides` as in `package.json` respected.

## Database migrations (`18`,`38`)
- Prisma migrations reviewed; applied via `migrate deploy` on release; expand/contract for zero-downtime; never edit shipped migrations; backup before risky migrations (`42`).

## Feature flags (`38`,`49`)
- Flag system for gradual rollout + kill-switches (incl. global agent-halt, `16`). Decouple deploy from release.

## Observability wiring (`39`,`41`)
- Structured logging, metrics, tracing, error reporting configured per env; dashboards + alerts provisioned via IaC.

## Rollback & safety (`38`,`40`)
- Immutable image tags; one-command rollback to previous image; migration rollback plan; graceful worker drain on deploy; canary/staged rollout.

## Developer experience
- `shopify app dev` + tunnel for local; seed scripts; `README`/`48` runbooks; pre-commit hooks (lint/typecheck) optional; fast CI feedback.

## Edge cases
- Migration fails on deploy → halt rollout, alert, rollback (`38`).
- Worker deploy during long jobs → drain + resume (`17`,`38`).
- Shopify app config drift → `shopify app deploy` versioned; reconcile.
- Secret rotation → rolling restart, no downtime.
- CI flakiness → quarantine + fix (`36`).

## Testing (of the pipeline)
- CI config validated; deploy dry-runs to staging; IaC plan reviewed; rollback rehearsed; DR drills (`42`).

## Future expansion
Multi-region deploys, blue-green/canary automation, progressive delivery, SLO-based auto-rollback, and self-service preview environments per PR (`50`).

## Decisions (ADR)
- **ADR-037-1:** Web + worker are one image, two entrypoints; deployed + scaled independently.
- **ADR-037-2:** All infra is IaC + reviewed; no click-ops in production.
- **ADR-037-3:** Deploy decoupled from release via feature flags; global kill-switch always available.

## Maintenance
Owned by DevOps. Pipeline + IaC reviewed each release; runbooks (`48`) kept current; dependency + Node/Shopify-lib upgrades on a cadence.
