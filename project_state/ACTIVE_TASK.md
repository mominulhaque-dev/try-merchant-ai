# Active Task

**M1.T6 — Real Store Health Dashboard** (docs/14). ✅ Done this session.

Replaced the Shopify template demo in `app/routes/app._index.tsx` with a production dashboard driven by a real, bounded Store Health quick scan:

- `app/lib/domain/store-health/` — pure `scoreSnapshot` (deterministic, unit-tested) + `captureStoreSnapshot` (read-only Admin GraphQL, bounded sample).
- Dashboard states per docs/14: first-run (no products), healthy (no findings), steady (ranked findings), section-level scan error. Live "Run scan" via `useFetcher`.
- Removed dead template route `app.additional.tsx`; trimmed nav to real routes.

**Verification owed (env-blocked this session):** run `npm run typecheck`, `npm run lint`, `npm run test`, `npm run dev`. Props were checked against `@shopify/polaris-types` by hand (notably `color="subdued"`, not `tone`).
