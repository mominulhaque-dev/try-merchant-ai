# 09 — User Flow

## Purpose
Document end-to-end flows a merchant travels, from install to recurring value, with decision points, states, and failure paths. Feeds IA (`10`), UX (`11`), and dashboard/chat specs (`14`,`15`).

## Goals
- Every critical path mapped including empty/error/degraded branches.
- Zero dead ends; every state has a next action.
- Trust-ladder gates (`00` P2) visible in flow.

## Notation
Flows written as step lists with `→` transitions and **[branch]** decision points. `(state)` marks UI states. Diagram source lives in Figma (`12`); this is the normative textual spec.

---

## Flow 1 — Install & First Value (activation-critical)
1. Merchant finds listing → clicks Install → Shopify OAuth consent (minimal scopes) → **[approve?]**
   - No → returns to App Store (no data stored).
   - Yes → OAuth callback, offline token stored (`25`), embedded app loads.
2. Welcome screen: 1-line value + "Run your first Store Health scan" CTA. (No long forms.)
3. Auto-start scan → **(loading)** progress by dimension.
   - **[scan partial/fail]** → show completed dimensions + retry failed (`40`).
4. **(success)** Prioritized findings list; top finding highlighted with estimated impact.
5. Guided first action: "Fix it" on a safe, reversible finding → preview diff → approve → execute → **(done + undo)**.
   - **[approve?]** No → keep as suggestion. Yes → execute → **activation event** fired (`29`).
6. Prompt: enable a relevant automation or explore Copilot. → Dashboard (`14`).
- **Success criteria:** first finding <60s; ≥1 approved action in session ideal; never a dead end.

## Flow 2 — Ask the Copilot
1. Merchant opens Copilot → **(empty)** suggested prompts ("What should I fix first?", "Why are sales down?").
2. Types question → **(thinking)** agent/tool status shown → **(streaming)** grounded answer.
3. **[actionable?]**
   - Yes → answer + action card → preview → approve → execute → done+undo (Flow 4).
   - No → answer + citations + follow-up suggestions.
4. **[model outage]** → banner + Suggest-only from cached context (`40`).
- **Rules:** no action without approval (MVP); every action audited.

## Flow 3 — Review & Act on Findings (recurring core loop)
1. Dashboard shows findings grouped by domain + severity.
2. Merchant filters/sorts (impact/effort/domain) → selects finding → detail (what/why/impact/how-to-undo).
3. Act (Flow 4) or dismiss (with reason → feeds learning) or snooze.
4. Bulk: select many → bulk fix → chunked execution with per-item status + partial rollback.

## Flow 4 — Execute an Action (the safety spine)
1. Preview: before/after diff, scope check, reversibility label.
   - **[irreversible]** → explicit confirm gate; **[reversible]** → standard approve.
2. Approve → **(executing)** → verify result.
   - **[success]** → audit log entry + undo affordance (time-boxed where relevant).
   - **[failure]** → reason + safe rollback of partials + retry/support (`40`).
3. **[resource changed since preview]** → re-preview (optimistic concurrency).

## Flow 5 — Configure Automation (V1)
1. Settings/Automations → choose template or from a finding → set trigger + autonomy level + guardrails (caps/allowlist).
2. **[autonomy > Approve]** → explicit consent + explain what runs unattended + kill-switch shown.
3. Enable → runs create audited jobs (`17`); run history visible; pause/kill anytime.

## Flow 6 — Billing & Upgrade
1. Feature/agent gated by plan or AAC cap → contextual upsell (value framed as MAVD).
2. Select plan → Shopify Billing confirmation → return → entitlement updated (`27`).
3. **[cap reached]** → block further metered actions, offer pack/upgrade, never surprise-charge.
4. Downgrade/cancel → one click; configured autonomies gracefully paused (`26`).

## Flow 7 — Onboarding for detected profile
- Onboarding branches by detected profile (catalog size, GMV signals, multi-store) to set autonomy defaults + suggested agents (`08`). Agency signals → suggest Scale/Plus.

## Flow 8 — Support & Escalation
1. In-app help → contextual docs → Copilot self-serve → **[unresolved]** → ticket (`47`).
2. Critical action gone wrong → prominent "Undo + Report" → auto-attaches audit context.

## Flow 9 — Uninstall / Offboarding
1. Merchant uninstalls in Admin → `app/uninstalled` webhook (`24`) → cancel jobs, invalidate tokens, start retention timer, send offboarding email (data export offer).
2. GDPR redact webhooks honored (`44`).
- **Rule:** clean teardown; no orphaned jobs or tokens.

## Cross-cutting flow rules
- **Every state** has empty/loading/success/error/partial variants (`11`).
- **Every mutation** passes Flow 4's spine.
- **Every dead-end avoided:** errors offer retry/support; empty states offer a first action.
- **Trust ladder visible:** autonomy level shown wherever an agent can act.

## Edge cases
- Scope revoked mid-flow → pause + explain + re-request (`26`).
- Concurrent merchant + agent edits → single-writer lock + reconcile (`00`,`16`).
- Long-running scan while merchant navigates away → background job + notify on completion (`28`).
- Session token expiry mid-session → transparent re-auth (`25`).

## Telemetry per flow
Fire events at each step (start/branch/success/fail) for funnel analysis (`29`): install→scan→first-action activation funnel is the primary instrument.

## Maintenance
Flows are normative; Figma prototypes must match. Any new feature adds/updates a flow here before design/build.
