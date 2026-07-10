# 41 — Logging

## Purpose
Define logging + audit standards: structured application logs, the immutable audit trail, correlation, retention, and privacy. Logs power debugging, monitoring (`39`), security (`32`), and the reversibility/trust guarantees (`00` P3).

## Goals
- Structured, correlated, queryable logs with zero PII/secrets leakage.
- An immutable, complete audit trail of every store mutation + sensitive event.
- Right retention balancing debuggability, cost, and privacy.

## Two distinct systems
1. **Application logs** — operational/diagnostic; structured JSON; aggregated (`39`); retention short-ish; NO PII/secrets.
2. **Audit log** — business/security record of mutations + sensitive actions; immutable/append-only; longer retention; before/after state; drives undo + compliance (`18` `AuditLog`).
Do not conflate them — audit is a durable product/compliance artifact, app logs are ephemeral diagnostics.

## Application logging standards
- **Format:** structured JSON. Fields: `timestamp, level, message, traceId, shop?, service, route/job, code?, durationMs?, meta`. Never free-text-only.
- **Levels:** `error` (needs attention), `warn` (degraded/handled), `info` (key lifecycle events), `debug` (dev/troubleshooting, off in prod by default).
- **Correlation:** `traceId` on every log line, propagated request→job→tool→external (`39`). One request's story is reconstructable across the async pipeline.
- **Context:** include `shop` (tenant) + relevant ids, but **never** tokens, secrets, PII, full prompts with customer data, or model outputs containing PII.
- **No PII/secrets rule (hard):** scrub/redact at the logging boundary; deny-list sensitive keys; review log statements in PR (`32`).

## Audit logging standards (`18`,`00` P3)
- **What's audited:** every store mutation (before/after, actor, target GID), permission changes, autonomy changes, billing events, compliance actions (data_request/redact), agent actions, logins/scope grants.
- **Fields:** `shop, actorType(agent|human|system), actorId, event, target, before, after, traceId, timestamp`.
- **Immutable/append-only:** no updates/deletes (except lawful redaction); tamper-evident (consider hash-chaining for enterprise).
- **Uses:** undo (before-state), merchant transparency (Reports history `30`), compliance exports (`44`), security investigations (`32`), MAVD (outcome context `29`).
- **Access:** role-gated (`26`); merchant sees their own; exports audited.

## AI-specific logging
- Log agent task lifecycle, tool calls (name + validated args summary, NOT raw PII), decisions, budget/cost, safety-blocks, refusals — for debugging + eval (`36`) + monitoring (`39`).
- **Prompt/response logging:** store enough to debug + evaluate, but **de-identify** customer PII; treat as sensitive; short retention; access-controlled. Never log secrets or another tenant's data.

## Retention & lifecycle (`42`,`44`)
| Log type | Retention (default) | Notes |
|---|---|---|
| App logs (info/warn/error) | ~30–90 days | cost + debuggability balance |
| Debug logs | minimal / on-demand | off in prod |
| Audit log | long (e.g., 1yr+; enterprise longer) | compliance + trust |
| AI prompt/response (de-identified) | short (e.g., 30 days) | eval/debug only |
| Security logs | per policy (longer) | investigations |
- Redaction: `customers/redact`/`shop/redact` purge relevant PII from logs + audit where lawful (`24`,`44`).
- Time-partitioned + auto-expired (`18`).

## Storage & access
- Aggregator (Loki/Datadog/ELK) for app logs; audit in Postgres (durable, queryable) + backed up (`42`).
- Access controlled + audited; least privilege; prod log access restricted (`32`).

## Security (`32`)
- No secrets/PII in logs (enforced by scrubber + review). Log access itself audited. Tamper-resistance for audit. Log injection prevented (encode/escape). Monitor for anomalous access.

## Correlation with monitoring/errors (`39`,`40`)
- `traceId` links logs ↔ traces ↔ error reports (Sentry). An alert → jump to correlated logs/trace for that `traceId`/shop.

## Edge cases
- High-volume shop → sampling for debug/info; always keep error + audit.
- Sensitive data accidentally logged → scrubber catches; PR review; incident if leaked (`48`).
- Redaction request → purge across logs + audit (retain minimal lawful record of the redaction itself).
- Log pipeline outage → local buffer + backpressure; never block the request path on logging.
- Cardinality/cost blowup → aggregate + sample; move detail to traces.

## Testing (`36`)
- Scrubber tests (PII/secrets never emitted), audit completeness tests (every mutation writes an audit row), immutability tests, traceId propagation tests, redaction tests (logs+audit purged), and access-control tests.

## Future expansion
Hash-chained tamper-evident audit, per-merchant audit export UI, SIEM integration, and AI-assisted log analysis for support/debugging (`50`,`47`).

## Decisions (ADR)
- **ADR-041-1:** App logs (ephemeral, no PII) and audit log (immutable, before/after) are separate systems.
- **ADR-041-2:** Every store mutation writes an immutable audit entry atomically with the change.
- **ADR-041-3:** No secrets/PII in application logs; AI prompt logs are de-identified + short-retention.

## Maintenance
Owned by Eng + Security. New mutations must audit; new log statements reviewed for PII. Retention + scrubber rules reviewed each release + privacy update (`44`).
