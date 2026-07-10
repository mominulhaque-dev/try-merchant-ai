# Known Issues

- **Verification pending (env-blocked):** this session's sandbox blocks Bash/`npm`. `typecheck`, `lint`, `test`, and `dev` for the new dashboard + store-health module must be run in a normal shell. Polaris `s-*` props were validated by hand against `@shopify/polaris-types`.
- **DB is still SQLite.** Anything requiring persistence (scan history, findings storage, billing, chat, audit rows) is blocked on the M0.T7 cutover. Action-pipeline adapters are ports-only until then.
- **Quick scan is interactive, not cached.** The dashboard runs a bounded (≤50 product) live Admin GraphQL read on load and on "Run scan". The queued background scan with cached snapshots + "as of" freshness (docs/14, docs/17) supersedes it at M1.T5/M0.T8. For very large catalogs it samples, framed honestly in the UI.
- **Public landing placeholder.** `app/routes/_index/route.tsx` still has template copy ("A short heading about [your app]"). Cosmetic; replace when marketing copy is finalized.
- **GDPR compliance webhooks commented out** in `shopify.app.toml` — launch-blocking, scheduled M1.T12 (docs/24/43).
