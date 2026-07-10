# 48 — Maintenance Guide & Runbooks

## Purpose
The operational handbook: routine maintenance, on-call runbooks, and incident procedures. This is what an engineer opens at 3am. Ties monitoring (`39`), errors (`40`), deploy (`38`), and backup (`42`) into actionable procedures.

## Goals
- Fast, consistent incident response (low MTTR).
- Documented routine maintenance so nothing rots.
- Every page-level alert (`39`) links to a runbook here.

## Routine maintenance cadence
| Cadence | Task |
|---|---|
| Continuous | Monitor SLOs, queues, cost, error rates, backup success (`39`,`42`) |
| Daily | Triage alerts + DLQ; review error spikes; check AI cost anomalies |
| Weekly | Dependency/security updates review; support-issue → backlog review (`47`); flaky-test triage (`36`) |
| Per release | Deploy checklist (`38`), post-deploy verification, changelog (`49`) |
| Monthly | Restore-verification review, access review, cost/margin review, SLO check |
| Quarterly | DR game-day (`42`), pentest/security review (`32`), Shopify Edition/API review (`22`,`43`), SLO re-baseline, doc audit |
| Per Shopify Edition | API-version upgrade, deprecation fixes, compliance re-verify (`43`) |

## On-call
- Rotation + escalation defined; primary/secondary. Alerts page primary (`39`). Every page → this doc's matching runbook. Post-incident → blameless post-mortem + action items + new tests (`36`).

## Runbooks

### RB-1 — App down / elevated 5xx (Sev-1)
1. Check status dashboards (`39`): web health, DB/Redis reachability, recent deploy.
2. If recent deploy correlates → **rollback** (previous image tag) (`38`).
3. Check DB (connections/locks/failover), Redis, Cloudflare/platform status.
4. Scale web if saturation; check readiness probes.
5. Update status page (`47`); comms. Post-mortem after recovery.

### RB-2 — Queue backlog / DLQ growth (`17`)
1. Identify queue + failing job type (dashboards).
2. Check downstream (Shopify throttle, provider outage, DB).
3. Scale workers if capacity-bound; fix + re-drive DLQ if bug; pause offending automation if runaway (`17`).
4. Verify idempotency before re-driving (no double effects).

### RB-3 — AI provider outage / degraded (`15`,`16`,`40`)
1. Confirm via provider status + our failover metrics.
2. Ensure failover chain active (secondary → cheap → Suggest-only from cache); verify degraded banner shows.
3. No queued mutation lost; jobs hold/retry.
4. Comms if prolonged. Restore + verify on recovery.

### RB-4 — Runaway AI cost / anomaly (`00` P7,`27`)
1. Identify shop/agent via cost dashboards.
2. Check for loop/abuse; engage circuit breaker / kill-switch for the agent/automation (`16`).
3. Verify caps/budgets enforced; reconcile metering (`27`).
4. Root-cause the loop; add guardrail/test.

### RB-5 — Harmful autonomous action reported (Sev-1) (`09` Flow 8,`47`)
1. **Global or scoped kill-switch** to halt agent execution (`16`).
2. Pull audit context (`41`); assess blast radius (how many shops/resources).
3. **Undo** reversible changes (bulk revert via before-state); gate irreversible.
4. Merchant comms + apology + fix; post-mortem; add red-team test (`36`).

### RB-6 — Security incident (`32`)
1. Contain (revoke tokens/keys, isolate); assess scope via audit + logs.
2. Eradicate + patch; rotate secrets.
3. Notify per legal obligations (merchants/regulators) (`44`).
4. Recover + monitor; full post-mortem; disclosure if required.

### RB-7 — Data incident / restore needed (`42`)
1. Identify scope (single shop vs. broad; corruption vs. loss).
2. PITR to just-before, or single-tenant restore; reconcile against redaction log (don't resurrect redacted PII).
3. Verify integrity; comms.

### RB-8 — Failed migration on deploy (`38`,`18`)
1. Halt rollout; assess (expand step should be backward-compatible).
2. Roll back app to prior image; DB usually needs no rollback (expand/contract).
3. If DB damaged → restore/PITR (`42`). Fix migration; re-attempt on staging first.

### RB-9 — Webhook verification-failure spike (`24`,`32`)
1. Possible attack or secret mismatch. Verify app secret + HMAC logic.
2. If attack → rate-limit/block; ensure invalid webhooks rejected (they should be).
3. Check for missed legitimate webhooks → reconciliation sync.

### RB-10 — Shopify API deprecation / version sunset (`22`,`43`)
1. Bump pinned API version; run codegen + typecheck + integration tests.
2. Fix deprecations; test on dev store; deploy per `38`.

## Routine operational tasks
- **Dependency updates:** review Dependabot/Renovate weekly; SCA gate; test before major bumps (Shopify libs, RR7, Prisma) (`37`).
- **Access reviews:** monthly least-privilege audit (infra, DB, support tooling) (`32`).
- **Cost/margin review:** monthly AI + infra cost vs. plan margins (`27`,`39`).
- **Doc audit:** quarterly — code vs. docs drift check (this repo).
- **Backup verification:** ensure restore tests passing (`42`).

## Kill-switches (know where they are)
- **Global agent halt** (stop all agent execution) (`16`).
- **Per-agent / per-automation pause** (`17`).
- **Feature flags** (disable a feature without deploy) (`37`).
- **Billing/metering safe-stop** (cap enforcement) (`27`).

## Edge cases
- Multiple simultaneous incidents → severity triage, incident commander role.
- On-call unavailable → escalation chain.
- Monitoring itself down → external synthetics + manual checks (`39`).

## Testing (`36`,`42`)
- Runbooks rehearsed (game-days for RB-1/5/6/7); kill-switches tested; rollback rehearsed; restore verified. A runbook untested is a hypothesis.

## Future expansion
Automated remediation (self-healing for known issues), incident-management tooling integration, SLO-based auto-rollback (`38`), and an internal ops copilot (`50`).

## Decisions (ADR)
- **ADR-048-1:** Every page-level alert maps to a runbook here; untested runbooks get rehearsed on game-days.
- **ADR-048-2:** Sev-1 harmful-action response leads with the kill-switch, then undo via audit before-state.

## Maintenance
Owned by DevOps/Eng. New alerts add runbooks; post-mortems add procedures + tests. Rehearse critical runbooks quarterly. Keep synced with `38`,`39`,`40`,`42`.
