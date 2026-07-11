import type { PlanTier, Role } from "../domain/enums";

/**
 * Resolve a shop's current entitlements for authorization (docs/26 four-gate).
 *
 * `grantedScopes` is authoritative and real — it comes straight from the
 * Shopify session's granted access scopes. `plan` and `role` are deliberate
 * pre-launch defaults: billing (M1) has not yet landed, so every install is
 * treated as the entry paid tier, and team management has not landed, so the
 * authenticated merchant is treated as the store OWNER. When those subsystems
 * ship they replace only these two fields — the shape and every call site stay
 * the same.
 */

export interface Entitlements {
  readonly grantedScopes: readonly string[];
  readonly plan: PlanTier;
  readonly role: Role;
}

/** Default plan until the Billing API is wired (docs/27, M1). */
const PRE_BILLING_PLAN: PlanTier = "GROWTH";
/** Default role until team management + online-token roles land. */
const INSTALLING_MERCHANT_ROLE: Role = "OWNER";

/** The minimal session shape we read; matches the Shopify offline session. */
export interface SessionScopes {
  readonly scope?: string | null;
}

export function resolveEntitlements(session: SessionScopes): Entitlements {
  const grantedScopes = (session.scope ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    grantedScopes,
    plan: PRE_BILLING_PLAN,
    role: INSTALLING_MERCHANT_ROLE,
  };
}
