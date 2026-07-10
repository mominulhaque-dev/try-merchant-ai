# 36 — Testing

## Purpose
Define the test strategy: what we test, how, and the quality gates that make "enterprise-grade, reversible, safe" verifiable rather than aspirational. Testing is part of Definition of Done (`00`).

## Goals
- Confidence to ship autonomous store-mutating AI safely.
- Fast feedback (unit) + high-value coverage (integration/e2e) + AI-specific evaluation.
- Automated quality gates in CI (`37`).

## Testing pyramid (+ AI layer)
```
        ┌───────────────┐
        │  Manual / QA  │  exploratory, a11y SR, release smoke
        ├───────────────┤
        │  E2E          │  critical flows on dev store
        ├───────────────┤
        │  Integration  │  services + PG + Redis + Shopify mock/dev
        ├───────────────┤
        │  Unit         │  domain logic, components, utils (most)
        └───────────────┘
   +  AI Evaluation harness (agents, prompts, safety) — runs per release
```

## Tooling
- **Unit/integration:** Vitest (Vite-native, matches stack). 
- **Component/interaction:** React Testing Library.
- **E2E:** Playwright (embedded app flows; auth against dev store).
- **A11y:** axe-core + jsx-a11y (already) + Lighthouse (`34`).
- **Contract:** Zod schema tests, GraphQL codegen type checks, API envelope tests (`19`).
- **Load:** k6/Artillery for web + queue; seeded large datasets.
- **AI eval:** custom harness (golden tasks, scenario suites, red-team).
- **Static:** `tsc --noEmit` (`typecheck`), ESLint (`lint`) — both already scripted.

## What to test by layer

### Unit
- Domain modules (scan prioritization, action pipeline validation, entitlement matrix, metering) as pure logic (`20`).
- Components: every state (empty/loading/success/error/partial/disabled/dark/mobile) + a11y assertions (`13`).
- Utils, formatters, guards.

### Integration
- Services against real Postgres + Redis (test containers) + mocked/dev Shopify.
- Tenant isolation (no cross-shop leakage) — mandatory (`32`).
- Job handlers: idempotency, retries, double-delivery, mid-failure rollback (`17`).
- Webhooks: HMAC verify + handler + idempotency (`24`).
- Billing: test-mode subscribe/upgrade/downgrade/cancel + metering + cap (`27`).
- Auth: session-token validation, offline-token refresh, uninstall invalidation (`25`).

### E2E (critical flows on dev store)
- Onboarding → first scan → first action (activation).
- Fix-it → preview → approve → execute → undo (the safety spine, `09` Flow 4).
- Copilot chat: ask → grounded answer → action offer → execute; stop-generation; degraded mode.
- Billing subscribe/cancel (test mode).
- Compliance webhooks (data_request/redact) actually export/delete (`24`,`44`).

### AI evaluation harness (unique + critical)
- **Golden task suites** per agent: fixed inputs → expected action/recommendation quality scored (rubric + LLM-as-judge + deterministic checks).
- **Safety/red-team:** prompt-injection attempts (malicious product/customer text), attempts to exceed scope/trust/budget, cross-tenant probes — all MUST be blocked by the policy layer (`16`,`32`).
- **Regression:** run each release; track quality + safety metrics over time; block release on safety regressions.
- **Determinism where possible:** tool-arg validation, policy-gate outcomes tested deterministically (not model-dependent).
- **Cost/latency benchmarks:** tokens/cost/TTFT per agent within budget (`33`).

## Non-functional testing
- **Performance:** budgets in CI (bundle size, Lighthouse, CWV for storefront), load tests (`33`).
- **Accessibility:** automated per PR + manual per release (`34`).
- **Security:** SCA/SAST gates, secret scanning, authz/isolation tests, periodic pentest (`32`).

## Test data & environments
- Seeded fixtures for shops/catalogs (including 100k-SKU + zero-product + new-store cases).
- Dev store for real Shopify integration; never test billing/webhooks against a live merchant.
- Deterministic factories; no reliance on external live services in unit/integration (mock providers + Shopify).

## Quality gates (CI, block merge/release)
- `typecheck` + `lint` clean.
- Unit + integration green; coverage thresholds on critical modules (action pipeline, policy layer, billing, isolation) high.
- A11y checks pass on covered paths.
- AI safety suite green (no injection/isolation/trust bypass).
- Performance budgets within limits.
- E2E green on critical flows before release.

## Edge-case catalog (must have tests)
- Scope revoked mid-action → rollback + notify.
- Concurrency conflict → re-preview, no double-apply.
- Provider outage → degrade, no lost jobs.
- Duplicate webhook/job → idempotent.
- Huge catalog → bulk + queued, no timeout.
- Irreversible action → confirm gate enforced.
- Downgrade → graceful pause.
- Redaction → data actually gone.

## Testing (meta)
CI runs unit+integration+a11y+safety on every PR; e2e + load + full AI eval on main/pre-release. Flaky tests quarantined + fixed, not ignored (`00` P8).

## Future expansion
Continuous AI eval dashboards, synthetic monitoring in prod, chaos engineering, mutation testing on critical modules, and property-based testing for the action pipeline (`50`).

## Decisions (ADR)
- **ADR-036-1:** AI safety/red-team suite is a launch-blocking CI gate; no release with a safety regression.
- **ADR-036-2:** Tenant-isolation + action-pipeline + billing modules require high coverage thresholds.
- **ADR-036-3:** Never test billing/compliance against live merchant stores.

## Maintenance
Owned by QA + Eng. Every feature ships with tests per its spec's acceptance criteria + edge cases. Golden/red-team suites grow with each incident + new agent. Flakes fixed promptly.
