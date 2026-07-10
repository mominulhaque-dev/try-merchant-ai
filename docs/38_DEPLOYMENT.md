# 38 — Deployment

## Purpose
Define how releases reach production safely: strategy, environments, migrations, Shopify app config deploy, rollout, and rollback. Complements `37` (pipeline) and `49` (release process).

## Goals
- Zero-downtime, reversible deploys.
- Safe DB migrations + Shopify config sync.
- Staged rollout with fast rollback + kill-switch.

## Deploy targets
Two coordinated deploys per release:
1. **Application** (web + worker containers) → hosting platform (`37`).
2. **Shopify app config + extensions** → `shopify app deploy` (app URLs, scopes, webhooks in `shopify.app.toml`, Theme App/Admin extensions in `extensions/*`). Versioned by Shopify; can be rolled back to a prior app version.

Both must be released together/compatibly (e.g., a new scope in toml + code that uses it).

## Strategy
- **Immutable images** tagged by commit SHA; promote the same artifact staging → prod.
- **Rolling / canary:** deploy to a subset, health-check, then full. Web behind Cloudflare + platform LB.
- **Decouple deploy from release:** ship dark behind feature flags (`37`,`49`); enable gradually.
- **Graceful worker drain:** on deploy, workers stop accepting new jobs, finish/return in-flight (BullMQ), then exit — no lost work (`17`).

## Environments flow
`Local → CI → Staging → Production` (`37`). Staging mirrors prod (managed PG/Redis, staging Shopify app, dev/test stores) and is the App-review rehearsal env (`43`).

## Database migrations (`18`)
- Applied via `prisma migrate deploy` (in `setup`) during release, **gated + reviewed**.
- **Zero-downtime expand/contract:** (1) additive migration deploy (backward-compatible), (2) code deploy using new schema, (3) later contract migration removes old. Never a destructive change in one step under load.
- **Backup before risky migration** (`42`); migration failure → halt rollout + rollback (`40`).
- SQLite→Postgres cutover is a one-time controlled migration (`18`); production starts on Postgres.

## Shopify config deploy specifics
- `shopify app deploy` publishes an **app version** (config + extensions). Scope changes trigger merchant re-consent (`26`); coordinate timing + messaging.
- Webhook subscription changes (esp. adding GDPR topics, `24`) go out with the config deploy; verify registration post-deploy.
- API version bumps (`22`) are a deliberate, tested release step.
- Rollback: revert to prior Shopify app version if config/extension breaks.

## Release sequencing (typical)
1. Merge to `main` → CI green (`37`).
2. Build + push images.
3. Deploy DB migration (expand) to prod (gated).
4. Deploy app (web+worker) canary → health checks → full; workers drain-safe.
5. `shopify app deploy` (config/extensions/webhooks).
6. Verify: health, webhook registration, key flows smoke, error/latency dashboards (`39`).
7. Gradually enable feature flags; watch metrics.
8. (Later) contract migration once new code is stable.

## Health & readiness
- `/health` (liveness) + `/ready` (dependencies: DB, Redis reachable) endpoints; platform probes gate traffic. Workers report queue connectivity.

## Rollback plan (`40`)
- **App:** redeploy previous image tag (one command) — fast.
- **Shopify config:** revert to prior app version.
- **DB:** prefer forward-fix; if needed, restore from backup / run down-migration (only if safe). Expand/contract makes most rollbacks not require DB changes.
- **Feature flag:** instant disable of a bad feature without redeploy.
- **Global kill-switch:** halt all agent execution (`16`) if AI misbehaves — independent of deploy.

## Scaling on deploy
- Autoscale web on CPU/latency, workers on queue depth (`17`,`33`). Min instances to avoid cold starts. Deploy doesn't reduce capacity below floor.

## Security (`32`)
- Secrets injected at runtime from secret manager; images carry none. TLS end-to-end. Post-deploy, verify security headers (`25`) + webhook HMAC still enforced.

## Edge cases
- Migration + code version skew → expand/contract + backward-compatible code prevents breakage.
- Deploy during Shopify incident → hold config deploy; app deploy independent.
- Scope change mid-rollout → re-consent handling; features gate until granted (`26`).
- Long-running scan during deploy → worker drain + job resume.
- Canary shows elevated errors → auto-halt promotion + rollback (`39`,`40`).
- Cloudflare/DNS change → staged, with fallback.

## Testing (`36`)
- Staging full e2e + smoke pre-promotion; migration dry-run on staging; rollback rehearsal; readiness-probe tests; post-deploy synthetic checks.

## Future expansion
Blue-green, automated SLO-based rollback, progressive delivery per shop cohort, multi-region, and per-PR preview environments (`50`,`37`).

## Decisions (ADR)
- **ADR-038-1:** Zero-downtime via expand/contract migrations + backward-compatible code.
- **ADR-038-2:** Deploy decoupled from release via feature flags; global agent kill-switch independent of deploy.
- **ADR-038-3:** App + Shopify config deploys are coordinated and independently rollback-able.

## Maintenance
Owned by DevOps. Every release follows the sequencing + has a rollback plan. Migration + rollback rehearsed on staging. Post-deploy verification checklist in `48`.
