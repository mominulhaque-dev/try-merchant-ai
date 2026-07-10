# 26 — Permission System

## Purpose
Define the three layers of permission: **Shopify scopes** (what the app can do on the store), **plan entitlements** (what the merchant paid for), and **RBAC** (what a given staff user/seat can do inside our app). Plus the trust ladder gate for agent autonomy.

## Goals
- Least-privilege, progressive Shopify scopes mapped 1:1 to features.
- Clean entitlement gating tied to billing (`27`).
- Enterprise-grade RBAC + audit for multi-seat/agency accounts.

## Layer 1 — Shopify scopes (app ↔ store)
- **Principle:** request the minimum scope for enabled features; add scopes progressively when a feature is turned on (`22`,`00` P4). Never pre-request "just in case."
- **Current scopes:** `write_products, write_metaobjects, write_metaobject_definitions`.
- **Scope registry (feature → scope):** every scope MUST have an entry here justifying it. Adding a scope requires updating this table + `shopify.app.toml` + a re-consent flow.

| Feature | Scope(s) | Justification |
|---|---|---|
| SEO/Content edits, catalog hygiene | `write_products`, `read_products` | edit product SEO, copy, images/alt |
| App config as metaobjects | `write_metaobjects`, `write_metaobject_definitions` | store structured app data natively |
| Analytics, MAVD, order-based insights | `read_orders` (or `read_all_orders` if >60d) | trends, attribution, inventory velocity |
| Inventory Agent | `read_inventory`, `write_inventory` (gated) | stockout/overstock, reorder actions |
| Content/Blog Agent | `read_content`, `write_content` | blog/collection copy |
| Theme Agent + Theme App Extension | `read_themes`, `write_themes` (gated) | theme performance, app blocks |
| Support Agent | `read_customers` (minimized) | context for replies (PII-minimized) |
| Marketing/Email | ESP APIs + `read_marketing_events`/analytics | campaigns (orchestrate ESPs) |
| Discounts/Functions | `write_discounts` (gated) | promo logic via Functions |

- **Scope changes at runtime:** `app/scopes_update` webhook (`24`) keeps our record of granted scopes in sync. If a scope is revoked, features needing it auto-pause (`40`) and prompt re-grant.
- **Enforcement:** the policy layer (`16`) checks scope presence before any tool/action; missing scope → block + request grant, never silent failure.

## Layer 2 — Plan entitlements (billing ↔ features)
- Plans (`02`,`27`) unlock agents, autonomy ceilings, seats, and AAC budgets. Entitlement checks gate features server-side (never client-only).
- **Entitlement model:** `Subscription.planTier` → an entitlement matrix (which agents, max trust level, seats, AAC/day, integrations). Checked in the policy layer + route guards.
- Downgrade → gracefully pause features/autonomies beyond the new plan (don't delete config; re-enable on upgrade). Cap reached → block metered actions + upsell, no bill-shock.

| Capability | Free | Growth | Pro | Scale/Plus | Enterprise |
|---|---|---|---|---|---|
| Agents | Health+Copilot | +SEO/CRO/Content/Analytics | +Email/Marketing/Inventory/Support/Rec | All incl. Theme/Workflow | All + custom |
| Max autonomy | Suggest | Approve | Auto (reversible) | Auto (guarded) | Custom policy |
| Seats | 1 | 1–2 | 5 | 10+ | Custom + SSO |
| Governance/audit export | basic | basic | full | full + policies | full + SSO/SLA |

## Layer 3 — RBAC (user ↔ app)
For multi-staff shops + agencies (`08` Devon/Riya/Alex). Additive to Shopify's own staff permissions (never bypasses them).

- **Roles:** `Owner`, `Admin`, `Operator` (can approve/execute actions), `Analyst` (read/reports only), `Viewer`. Enterprise: custom roles.
- **Permission matrix (examples):**

| Action | Owner | Admin | Operator | Analyst | Viewer |
|---|---|---|---|---|---|
| Change billing/plan | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set agent autonomy | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve/execute action | ✅ | ✅ | ✅ | ❌ | ❌ |
| Configure automations | ✅ | ✅ | ✅ | ❌ | ❌ |
| View reports/audit | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage seats/roles | ✅ | ✅ | ❌ | ❌ | ❌ |

- **Identity:** derived from Shopify online-token user (`25`) mapped to a role. Account owner defaults to Owner.
- **Enforcement:** every privileged route/action checks role + entitlement + scope + trust level. Server-side only.
- **Audit:** every permission-relevant action logs actor + role (`41`).

## Trust ladder gate (autonomy)
- Orthogonal but combined: an action executes only if **scope present AND plan allows the trust level AND user role permits AND agent's configured trust level ≥ required** (`16`,`00` P2). All four must pass. Escalating an agent's autonomy is itself a gated, audited, confirm-required action.

## Agency / multi-store (future `50`)
- Org layer above shops: an agency user has roles per client store; data isolated per shop; billing at org level; per-client governance + audit. Designed for now via the `shop` tenant key + a future `Org`/membership model.

## Security (`32`)
- Deny-by-default; explicit allow. No permission check bypassable from the client. Tenant isolation always first. Sensitive permission changes require re-auth/confirmation (step-up for high-risk).

## Edge cases
- Scope revoked mid-automation → pause + notify + re-request (`24`,`40`).
- Downgrade removes a seat's role → that user drops to Viewer gracefully.
- Collaborator with limited Shopify perms → cannot exceed Shopify's own limits regardless of our role.
- Conflicting roles (agency + shop staff) → most-restrictive wins per resource.
- Plan cap mid-action → finish in-flight safely, block new, upsell.

## Testing (`36`)
- Scope-gate tests (missing scope blocks tool), entitlement-matrix tests per plan, RBAC matrix tests per role, trust-ladder combination tests (all four gates), scope-revoke → pause tests, downgrade grace tests, and tenant-isolation/authorization tests (no privilege escalation, no cross-shop).

## Future expansion
SSO/SCIM provisioning, custom enterprise roles, fine-grained per-agent/per-resource policies, approval workflows (multi-approver for high-risk actions) (`50`).

## Decisions (ADR)
- **ADR-026-1:** Four-gate authorization (scope + plan + role + trust) for every mutating action.
- **ADR-026-2:** Scopes requested progressively per feature; scope registry in this doc is the SSOT.
- **ADR-026-3:** Our RBAC is additive to Shopify staff permissions and never bypasses them.

## Maintenance
Owned by Security. Any new feature updates the scope registry + entitlement matrix here (same PR). Permission changes reviewed by Security; keep matrices synced with `27` + `16`.
