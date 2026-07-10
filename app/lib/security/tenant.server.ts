import { AppError } from "../errors";

/**
 * Multi-tenant isolation primitives (docs/32 "Tenant isolation", docs/18).
 *
 * Every shop-scoped data access MUST go through {@link scoped}, which brands the
 * where-clause as {@link ShopScoped}. Repositories accept only `ShopScoped`
 * filters, making an unscoped shop query a *compile-time* error rather than a
 * convention — a stronger guarantee than "remember to filter by shop".
 */

/** A validated Shopify shop domain, e.g. `example.myshopify.com`. */
export type Shop = string & { readonly __brand: "Shop" };

/** A Prisma where-clause proven to be constrained to a single shop. */
export type ShopScoped<T> = T & { readonly __shopScoped: "ShopScoped" };

const SHOP_DOMAIN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

/**
 * Validate + brand a shop domain. Throws UNAUTHENTICATED for a missing/invalid
 * value so callers can't proceed with an unknown tenant.
 */
export function assertShop(value: string | null | undefined): Shop {
  if (!value || !SHOP_DOMAIN.test(value)) {
    throw new AppError("UNAUTHENTICATED", {
      details: { reason: "invalid_shop_domain" },
    });
  }
  return value as Shop;
}

/** Non-throwing check for a shop domain. */
export function isShop(value: unknown): value is Shop {
  return typeof value === "string" && SHOP_DOMAIN.test(value);
}

/**
 * Constrain a where-clause to a single shop and brand it `ShopScoped`. This is
 * the only sanctioned way to build a shop-scoped Prisma filter.
 *
 * @example
 *   prisma.finding.findMany({ where: scoped(shop, { status: "OPEN" }) })
 */
export function scoped<T extends object>(
  shop: Shop,
  where?: T,
): ShopScoped<T & { shop: Shop }> {
  return { ...(where ?? ({} as T)), shop } as ShopScoped<T & { shop: Shop }>;
}

/**
 * Assert that a row loaded from anywhere actually belongs to `shop` before it
 * is used or returned — defense in depth against a missing filter (docs/32).
 */
export function assertOwnership<T extends { shop: string }>(
  shop: Shop,
  row: T,
): T {
  if (row.shop !== shop) {
    throw new AppError("NOT_FOUND", { details: { reason: "cross_tenant" } });
  }
  return row;
}
