# 42 — Backup & Disaster Recovery

## Purpose
Define backup, restore, retention, and disaster-recovery (DR) so we never lose merchant data and can recover from failures within defined objectives. Also covers data-lifecycle post-uninstall (ties to `44`).

## Goals
- Defined, tested **RPO/RTO**; no unrecoverable data loss.
- Automated, verified backups; rehearsed restores.
- Clean, compliant data teardown on uninstall/redaction.

## Recovery objectives (targets)
| System | RPO (max data loss) | RTO (max downtime) |
|---|---|---|
| Postgres (primary datastore) | ≤ 5 min (PITR) | ≤ 1 hr |
| Object storage (exports/artifacts) | ≤ 24 hr (versioned) | ≤ 4 hr |
| Redis (queue/cache) | best-effort (not source of truth) | ≤ 15 min (rebuild) |
| Config/IaC/secrets | 0 (in VCS + secret mgr) | ≤ 1 hr |
- Redis is **not** a source of truth — durable state lives in Postgres (`17`,`18`); losing Redis loses in-flight cache/queue only, and jobs are idempotent/resumable.

## What we back up
- **Postgres:** automated managed backups + **point-in-time recovery (PITR)** via WAL; daily full + continuous. Includes all shop data, audit log, billing, memory (`18`,`31`,`41`).
- **Object storage:** versioning + lifecycle (exports, generated reports, JSONL bulk artifacts).
- **Config/IaC:** in Git (`37`); secrets in secret manager with its own backup/rotation.
- **Vector data:** if separate store, backed up; if pgvector, covered by PG backups.

## Backup strategy
- Managed DB provider automated backups (encrypted at rest) + PITR window (e.g., 7–30 days).
- **Cross-region/off-site** backup copies for DR (region failure).
- **Encryption** of backups (at rest + in transit); access controlled + audited (`32`).
- **Immutability/retention lock** on backups where supported (ransomware/tamper protection).

## Restore & DR
- **Restore procedures documented + rehearsed** (`48`): full restore, PITR to a timestamp, single-tenant restore (recover one shop's data from backup for support/mistake).
- **DR runbook:** region failover, provider outage, data-corruption recovery. Defined roles + comms (`48`,`47`).
- **Backup verification:** periodic automated restore-to-scratch + integrity checks — a backup is only real if a restore is proven. Alert on backup failure/staleness.
- **DR drills:** scheduled game-days simulating DB loss / region loss, measured against RPO/RTO.

## Migrations & backups (`38`,`18`)
- Backup (or ensure PITR covers) **before risky migrations**; expand/contract reduces need for restore; documented rollback.

## Data lifecycle & compliance (`44`,`24`)
- **On uninstall (`app/uninstalled`):** mark uninstalled, stop processing, start retention timer.
- **`shop/redact` (≥48h post-uninstall):** delete all shop data per policy across PG + object storage + logs/audit (retain minimal lawful record of the deletion), and **from backups per policy** (backups age out within the retention window; document that redaction of backups occurs via expiry, with the window disclosed).
- **`customers/redact` / `customers/data_request`:** delete/export specific customer data (`44`).
- Retention windows documented + honored; deletions audited (`41`).
- **Tenant-scoped restores** must not resurrect redacted data (reconcile restores against redaction log).

## Business continuity
- Multi-AZ managed DB/Redis; stateless web + workers redeployable anywhere (`37`); IaC enables rebuild from scratch. Provider-outage playbook (degrade, failover, comms).

## Security (`32`)
- Backups encrypted + access-controlled + audited; least-privilege restore access; secrets never in DB backups (separate secret manager); test restores in isolated env (no prod contamination).

## Edge cases
- Restore resurrecting redacted PII → reconcile with redaction log; re-apply redactions post-restore.
- Partial corruption → single-table/tenant restore; PITR to just-before corruption.
- Backup itself corrupted → multiple generations + cross-region copies + verification catch it.
- Redis loss with in-flight jobs → jobs re-enqueued/resumed; idempotency prevents double effects (`17`).
- Region outage → failover region + off-site backups.
- Long retention vs. GDPR → documented policy reconciles debuggability with deletion rights.

## Testing (`36`,`48`)
- Automated restore verification (restore-to-scratch + integrity), DR game-days (RPO/RTO measured), redaction-after-restore tests, backup-failure alerting tests, single-tenant restore tests.

## Future expansion
Continuous replication to a standby region with fast failover, self-service tenant data export/restore, longer enterprise retention tiers, and customer-managed keys for backups (`50`,`32`).

## Decisions (ADR)
- **ADR-042-1:** Postgres is the only source of truth; Redis loss is recoverable via idempotent jobs.
- **ADR-042-2:** Backups are encrypted, cross-region, and restore-verified — untested backups don't count.
- **ADR-042-3:** Redaction of backups occurs via bounded retention expiry; the window is documented + disclosed (`44`).

## Maintenance
Owned by DevOps. Backup config in IaC; restore + DR runbooks (`48`) rehearsed on a schedule; retention/redaction reconciled with `44` each privacy review. Monitor backup success + freshness (`39`).
