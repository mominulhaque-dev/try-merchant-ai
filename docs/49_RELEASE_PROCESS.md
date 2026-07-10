# 49 — Release Process

## Purpose
Define how changes are versioned, reviewed, released, and communicated — the process discipline that keeps a fast-moving, store-mutating AI product safe + auditable. Complements `37` (pipeline) + `38` (deployment).

## Goals
- Predictable, low-risk releases with clear ownership + changelog.
- Decoupled deploy vs. release (flags) so we ship continuously but expose deliberately.
- Traceability: every change → PR → tests → release → changelog.

## Versioning
- **Semantic versioning** for the app (`MAJOR.MINOR.PATCH`) — internal reference + changelog anchor.
- **Shopify app versions** are separate (published via `shopify app deploy`, `38`); coordinate but track distinctly.
- **Conventional Commits** drive automated changelog + version bump (`feat`→minor, `fix`→patch, `feat!`/`BREAKING`→major).

## Branching & PR flow (`37`)
- Trunk-based: short-lived branches → PR → review → merge to `main`. `main` always releasable.
- **PR requirements:** description + linked spec/issue (`06`,`07`), passing CI (typecheck, lint, tests, a11y, AI safety, security, build, perf budget), review approval, docs updated (`00` DoD).
- No merge with red checks; no direct pushes to `main`.

## Release cadence
- **Continuous delivery to staging** on merge; **production releases** on a regular cadence (e.g., daily/several-times-weekly) + hotfixes as needed.
- **Feature flags** decouple deploy from exposure (`37`): ship dark → enable via flag → gradual rollout by cohort → GA.

## Release train (steps)
1. Merge to `main` → CI green → build images.
2. Auto-deploy to **staging**; run e2e + smoke (`36`).
3. **Release review** (brief): what's shipping, risk, flags, migration (expand step), rollback plan.
4. **Production deploy** per `38` (migration expand → canary → full → `shopify app deploy` → verify).
5. **Progressive rollout** of flagged features; watch metrics (`39`).
6. **Changelog** published; stakeholders + (for merchant-facing) merchants notified (`28`).
7. Contract migration later once stable (`38`).

## Change classification & risk
| Class | Examples | Extra care |
|---|---|---|
| Trivial | copy, styling | standard CI |
| Standard | feature behind flag | flag + metrics watch |
| Risky | migration, new scope, billing, agent autonomy change | staged rollout, extra review, rollback rehearsed, security/PM sign-off |
| Compliance | webhooks, privacy, scopes | Legal/Security sign-off, `43` re-check |
- **New Shopify scope** → coordinate re-consent + listing/privacy updates (`26`,`43`,`44`).
- **Agent autonomy/graduation** → gated by eval + safety suite (`36`) + explicit product decision (`16`).
- **API-version bump** → its own tested release (`22`).

## Changelog & communication
- **Internal changelog:** every release (auto from Conventional Commits) — what/why/risk.
- **Merchant-facing changelog / "What's new":** in-app + site for notable features (`28`); honest, benefit-framed (`05`).
- **ADRs:** architectural decisions logged in the relevant doc (`00` convention).
- **Breaking/behavioral changes** to agents or actions → clear merchant notice (trust `00` P1).

## Hotfix process
- Critical bug/security → hotfix branch → expedited CI → targeted deploy/rollback → backport to `main` → post-mortem if incident (`48`).

## Rollback (`38`,`40`)
- Every release has a rollback plan: previous image, Shopify app version revert, feature-flag disable, DB via expand/contract. Kill-switch for agent misbehavior (`16`).

## Quality gates (must pass to release)
- CI green (all gates `37`), staging e2e green, AI safety suite green (`36`), perf budgets (`33`), compliance checks for compliance-class changes (`43`), release review sign-off.

## Ownership & roles
- **Release owner** per train (rotating) runs the checklist + monitors post-deploy.
- Risky/compliance changes need the relevant hat's sign-off (Security/PM/Legal).

## Edge cases
- Failed staging e2e → block release, fix first.
- Migration issue → halt + rollback (`38`,`48` RB-8).
- Flagged feature misbehaves in rollout → disable flag instantly, no redeploy.
- Concurrent releases → serialize; one release train at a time to prod.
- Shopify incident during release → hold config deploy; app deploy independent (`38`).
- Emergency compliance fix → expedited but still tested (`43`).

## Testing (of the process)
- Release checklist rehearsed; rollback + flag-disable tested; changelog automation verified; staging mirrors prod (`38`).

## Future expansion
Automated release notes with AI summarization, SLO-gated auto-promotion/rollback, canary analysis automation, per-cohort progressive delivery, and a public roadmap/changelog (`50`).

## Decisions (ADR)
- **ADR-049-1:** Deploy is decoupled from release via feature flags; features GA by gradual, metric-watched rollout.
- **ADR-049-2:** Risky/compliance changes require staged rollout + relevant sign-off + rehearsed rollback.
- **ADR-049-3:** Every release produces an internal changelog (auto) + merchant-facing notes for notable changes.

## Maintenance
Owned by Eng. Process reviewed quarterly; checklist kept current with `37`/`38`. Conventional Commits + changelog automation maintained. Post-incident improvements folded into the process.
