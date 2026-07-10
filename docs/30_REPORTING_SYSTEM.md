# 30 — Reporting System

## Purpose
Define merchant-facing reports: ROI/MAVD, action history, agent activity, and exports. Reports turn the analytics engine (`29`) into legible proof-of-value that drives retention + expansion (`27`).

## Goals
- A weekly ROI report that makes the plan self-justifying.
- Trustworthy, auditable, exportable reports.
- Fast to render (precomputed), accessible, and honest about confidence.

## Report catalog
1. **ROI / MAVD report** (flagship) — value delivered this period (incremental revenue, hours saved, inventory saved, deliverability revenue), with confidence, trend vs. prior period, and per-agent contribution. Drives "this app pays for itself."
2. **Action history** — every executed action (audit-backed, `41`): what, by whom/which agent, when, before/after, outcome, reversible/reverted. Filterable, exportable.
3. **Agent activity** — per-agent tasks, findings produced, actions executed, success/revert rate, AAC used.
4. **Store health trend** — health score over time + domain breakdown.
5. **Automation runs** — history, outcomes, anomalies/pauses (`17`).
6. **Usage & billing** — AAC consumption vs. allotment, plan (`27`).
7. **Compliance/audit export** (enterprise) — full audit log export (`26`,`41`).

## Architecture
- Reports read **precomputed aggregates** from the analytics engine (`29`), not live heavy queries — fast + consistent (`33`).
- Route `app/routes/app.reports.tsx` (`10`); sub-views per report; filters via URL params.
- Scheduled generation (weekly digest, `28`) via jobs (`17`); on-demand rendering from cache.
- **Exports:** CSV/PDF generated in jobs → stored in object storage → signed download link (`42`). Large exports async + notify.

## MAVD reporting principles (`29`)
- Always show **confidence** + **method** (A/B, pre/post, direct) — never fake precision.
- Show ranges for uncertain figures; label assumptions (labor rate, margin).
- Per-agent attribution so merchant sees which agents earn their keep.
- Trend + cumulative value; compare to plan cost ("delivered $X vs. $Y plan").

## UX (`11`,`13`,`14`)
- `RoiStat`/`MetricCard`, trend charts (with text/table alternative for a11y), filterable tables (`IndexTable`), export buttons.
- Empty/low-data states show ranges + "gathering data," not blanks.
- "As of" timestamps; explain how numbers are computed (expandable methodology).
- Deep-links from dashboard + email digest land on the relevant report (`10`,`28`).

## Accessibility (`34`)
- Charts have accessible summaries + data tables; color-independent; keyboard-navigable; screen-reader-friendly figures with units.

## Performance (`33`)
- Precomputed metrics; paginate/virtualize history; stream/defer heavy sections; cache with revalidation; export generation off the request path.

## Security & privacy (`32`,`44`)
- Shop-scoped; role-gated (Analyst+ can view; exports may be Admin+) (`26`); no cross-tenant data; exports contain only the merchant's own data; signed, expiring download links; audit report exports.

## Edge cases
- Sparse/new store → ranges + "insufficient data," never fabricated ROI.
- Conflicting attribution → lower confidence + explanation.
- Very large history export → async job + notify + chunked file.
- Reverted actions → shown as reverted, excluded from positive MAVD (or netted).
- Currency/locale → localized formatting; multi-currency handled.
- Downgrade/plan change mid-period → report spans correctly.

## Testing (`36`)
- Aggregation-to-report correctness (golden data), confidence labeling, export integrity (CSV/PDF content + signed links), role-gating, a11y (chart alternatives), locale formatting, and no-cross-tenant tests.

## Future expansion
Scheduled email PDF reports, custom report builder, benchmark comparisons ("you vs. similar stores," anonymized `29`), goal tracking, and shareable public ROI cards (opt-in, `01`) (`50`).

## Decisions (ADR)
- **ADR-030-1:** Reports read precomputed aggregates; no heavy live queries in the request path.
- **ADR-030-2:** Every MAVD figure shows method + confidence; reverted actions never count as positive value.

## Maintenance
Owned by Data/PM. New reports define data source (precomputed), a11y (chart alternative), role-gating, export format, tests. Keep methodology docs synced with `29`.
