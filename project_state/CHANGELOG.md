# Changelog (project_state)

> Terse, newest first. Full narrative history is in root `CHANGELOG.md`.

## 2026-07-11
- Added Store Health quick-scan module (`app/lib/domain/store-health`): pure, deterministic `scoreSnapshot` + read-only `captureStoreSnapshot` (Admin GraphQL, bounded sample), with unit tests.
- Replaced the Shopify template demo dashboard (`app/routes/app._index.tsx`) with a real Store Health dashboard: health score, ranked findings, first-run/healthy/error states, live "Run scan".
- Removed dead template route `app.additional.tsx`; trimmed app nav to real routes (Home, Agents).
- Created the mandated `/project_state` governance files (this set).
