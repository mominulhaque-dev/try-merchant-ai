import type { PrismaClient } from "@prisma/client";

/**
 * GDPR / mandatory compliance webhook logic (docs/24 §Compliance handlers,
 * docs/44 privacy, docs/43 App Store). Shopify sends three compliance topics
 * that MUST be handled before public launch:
 *
 *   - `customers/data_request` — provide the data we hold on a customer.
 *   - `customers/redact`       — delete a customer's PII.
 *   - `shop/redact`            — delete all shop data (≥48h after uninstall).
 *
 * The app **minimizes PII by design** (docs/32): the only persisted, tenant-owned
 * data today is the shop-scoped Shopify `Session` (offline token + shop domain) —
 * there is no customer-scoped storage yet. So `shop/redact` deletes sessions, and
 * the two `customers/*` handlers truthfully report that no customer PII is held.
 * These are ports so the logic is unit-testable without Prisma, and so the
 * customer handlers gain real deletions unchanged once customer-scoped tables
 * land (docs/18) — just extend {@link ComplianceStore}.
 */

/** The persistence surface the compliance actions touch (ports-and-adapters). */
export interface ComplianceStore {
  /** Delete all offline sessions for a shop; returns the row count removed. */
  deleteShopSessions(shop: string): Promise<number>;
  /**
   * Delete stored PII for a single customer in a shop; returns rows removed.
   * Currently always 0 — no customer-scoped PII is persisted (see module docs).
   */
  deleteCustomerData(shop: string, customerId: string): Promise<number>;
  /**
   * Collect stored records for a single customer, to hand back to the merchant.
   * Currently always empty — no customer-scoped PII is persisted.
   */
  collectCustomerData(shop: string, customerId: string): Promise<unknown[]>;
}

/** A {@link ComplianceStore} backed by Prisma. */
export function prismaComplianceStore(db: PrismaClient): ComplianceStore {
  return {
    async deleteShopSessions(shop) {
      const result = await db.session.deleteMany({ where: { shop } });
      return result.count;
    },
    // No customer-scoped tables exist yet, so there is nothing to delete or
    // return. When they land (docs/18), query them here — the callers/handlers
    // and webhook wiring do not change.
    async deleteCustomerData() {
      return 0;
    },
    async collectCustomerData() {
      return [];
    },
  };
}

/* ------------------------------------------------------- Payload parsing --- */

/** The shape of Shopify's compliance webhook payloads (fields we read). */
interface CompliancePayload {
  shop_domain?: string;
  customer?: { id?: number | string; email?: string };
  data_request?: { id?: number | string };
}

/** Extract the customer id from a `customers/*` compliance payload, if present. */
export function extractCustomerId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const customer = (payload as CompliancePayload).customer;
  const id = customer?.id;
  return id != null ? String(id) : undefined;
}

/** Extract the data-request id (for auditing the `customers/data_request`). */
export function extractDataRequestId(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) return undefined;
  const id = (payload as CompliancePayload).data_request?.id;
  return id != null ? String(id) : undefined;
}

/* --------------------------------------------------------- Compliance ops -- */

export interface ShopRedactResult {
  readonly shop: string;
  readonly sessionsDeleted: number;
}

/** `shop/redact`: erase all persisted shop data (docs/24, docs/42 retention). */
export async function redactShop(
  store: ComplianceStore,
  shop: string,
): Promise<ShopRedactResult> {
  const sessionsDeleted = await store.deleteShopSessions(shop);
  return { shop, sessionsDeleted };
}

export interface CustomerRedactResult {
  readonly shop: string;
  readonly customerId?: string;
  readonly piiRecordsDeleted: number;
}

/** `customers/redact`: hard-delete a customer's PII across shop-scoped storage. */
export async function redactCustomer(
  store: ComplianceStore,
  shop: string,
  customerId: string | undefined,
): Promise<CustomerRedactResult> {
  const piiRecordsDeleted = customerId
    ? await store.deleteCustomerData(shop, customerId)
    : 0;
  return { shop, customerId, piiRecordsDeleted };
}

export interface CustomerDataResult {
  readonly shop: string;
  readonly customerId?: string;
  readonly records: readonly unknown[];
}

/** `customers/data_request`: gather the data we hold on a customer. */
export async function collectCustomerData(
  store: ComplianceStore,
  shop: string,
  customerId: string | undefined,
): Promise<CustomerDataResult> {
  const records = customerId ? await store.collectCustomerData(shop, customerId) : [];
  return { shop, customerId, records };
}
