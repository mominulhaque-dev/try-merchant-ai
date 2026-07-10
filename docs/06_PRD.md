# 06 — Product Requirements Document (PRD)

## Purpose
Translate the vision (`01`) into buildable, testable requirements for MVP → V1, with acceptance criteria, scope boundaries, and success metrics. This is the contract between product and engineering.

## Goals
- Ship a wedge (Store Health + Copilot) that delivers value on install with zero config.
- Prove safe, reversible agent execution.
- Instrument everything for MAVD and activation.

## In scope (MVP → V1) / Out of scope
**In (MVP):** onboarding, Store Health Agent, AI Copilot chat, action execution pipeline (Suggest→Approve→Execute), audit log, billing, first 3–4 domain agents (SEO, CRO, Content, Analytics).
**In (V1):** Email, Marketing, Inventory, Support, Recommendation, Theme, Workflow agents; automation engine; notifications; reporting; memory.
**Out (for now):** multi-channel (Amazon/TikTok), full B2B, agent marketplace/SDK, white-label. Tracked in `50`.

## Personas served
See `08`. Primary: overwhelmed operator. Secondary: scaling brand. Tertiary: agency.

## Requirements by epic

### EPIC 1 — Onboarding & Activation
**User story:** As a new merchant, I want value within minutes without configuring anything.
- FR1.1 On install, run OAuth (already built), request minimal scopes, land in embedded app (`25`).
- FR1.2 Kick off an initial **Store Health scan** automatically; show progress, then a prioritized action list. (Zero-config aha; `01`.)
- FR1.3 Guided first action: merchant approves one recommendation → executed + undo shown. Activation event fired (`29`).
- FR1.4 Progressive scope requests: only ask for a scope when the merchant enables a feature needing it (`26`).
- **Acceptance:** first insight visible <60s after scan start (p50); ≥1 approvable action always present; no dead-end empty states.

### EPIC 2 — Store Health Agent
**User story:** Tell me what's wrong and what to fix first.
- FR2.1 Audit dimensions: SEO (titles/meta/alt/structured data), CRO (PDP/cart friction), content quality (thin/missing copy), catalog hygiene (missing images, variants), performance/theme signals, inventory risk (stockout/overstock).
- FR2.2 Each finding: severity, plain-language explanation, estimated impact, recommended action, effort, "fix it" affordance.
- FR2.3 Prioritized by impact × confidence × effort. Re-scan on demand + scheduled (`17`).
- **Acceptance:** findings are explainable, deduped, non-destructive to compute; every "fix it" maps to a typed, reversible action.

### EPIC 3 — AI Copilot Chat
**User story:** Let me ask anything about my store and act on it.
- FR3.1 Chat with streaming responses; grounded in live store data + memory (`15`, `31`).
- FR3.2 Can call tools to read store data and (with approval) execute actions (`16`, `19`).
- FR3.3 Every actionable answer offers a one-click, reversible execution with preview.
- FR3.4 Cites what data it used; shows agent/tool activity transparently.
- **Acceptance:** no action executes without explicit approval at MVP; all mutations audited; graceful degradation on model outage (`40`).

### EPIC 4 — Action Execution & Audit
- FR4.1 All mutations flow through the typed action pipeline: validate → dry-run/preview → approve → execute → verify → log → offer undo (`16`, `17`).
- FR4.2 Immutable audit log with before/after, actor (agent/human), timestamp, reversal status (`41`).
- FR4.3 Undo restores prior state where technically possible; irreversible actions are gated with explicit confirmation.
- **Acceptance:** 100% of mutations logged; undo works for all reversible action types in test suite.

### EPIC 5 — Domain Agents (SEO, CRO, Content, Analytics for MVP)
- FR5.x Each agent has responsibilities, tools, memory scope, budget, fallback per `16`. Enter at Suggest; graduate per trust ladder.
- **Acceptance:** each agent passes its scenario test set; stays within tool allowlist + budget.

### EPIC 6 — Billing & Plans
- FR6.1 Plans + AAC metering via Shopify Billing API; trial; usage caps; upgrade/downgrade; test charges in dev (`27`).
- **Acceptance:** no feature gated incorrectly; no bill-shock (hard caps); passes Billing review (`43`).

### EPIC 7 — Notifications & Reporting (V1)
- FR7.1 In-app + email digests of findings, actions, outcomes (`28`).
- FR7.2 Weekly ROI/MAVD report + exports (`30`).

### EPIC 8 — Compliance & Security (launch-blocking)
- FR8.1 GDPR webhooks (`customers/data_request`, `customers/redact`, `shop/redact`) implemented (`24`, `44`).
- FR8.2 Session-token auth, HMAC verification, encryption, least privilege (`25`, `26`, `32`).
- **Acceptance:** passes `43` checklist; security review signed off.

## Non-functional requirements (NFRs)
- **Performance:** embedded app TTI within budget; API p95 targets (`33`).
- **Scalability:** design for 10k+ shops; queue-based agent work (`17`, `20`).
- **Reliability:** target 99.9% for core app; graceful degradation on AI/provider outage.
- **Security/Privacy:** `32`, `44`. **Accessibility:** WCAG 2.2 AA (`34`). **Observability:** `39`.

## Success metrics (per `01`)
- Activation (≥1 approved action in 7d) — target ≥40% of installs.
- WAS, autonomy adoption, MAVD, NRR, review rating.
- Guardrail metrics: mutation error rate, undo rate, complaint/uninstall reasons.

## Release plan (high level)
- **Alpha (design partners):** EPIC 1–4 + SEO/Content agents; Suggest/Approve only.
- **Beta:** + CRO/Analytics, billing, notifications; limited Auto-execute (reversible).
- **GA / App Store submission:** full V1 agent set (as ready), compliance complete (`43`), pricing live.

Detailed feature-level specs in `07`. Roadmap beyond V1 in `50`.

## Edge cases (product-level)
- New store with almost no data → health scan focuses on setup completeness, not optimization.
- Huge catalog (100k+ SKUs) → paginated/queued scans, sampling, no timeouts (`17`, `22`).
- Merchant revokes scope / uninstalls mid-task → cancel + rollback + notify (`26`, `40`).
- Conflicting edits by two agents → single-writer lock + reconciliation (`00`, `16`).

## Testing
Each FR has acceptance tests; critical flows (onboarding, execute+undo, billing) have e2e; agents have scenario suites; compliance webhooks have integration tests (`36`).

## Maintenance
PRD is versioned; changes require PM sign-off + ADR when scope shifts. Keep FR IDs stable for traceability to tests and `07`.
