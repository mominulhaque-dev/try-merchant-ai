import { describe, it, expect } from "vitest";
import {
  redactShop,
  redactCustomer,
  collectCustomerData,
  extractCustomerId,
  extractDataRequestId,
  type ComplianceStore,
} from "./gdpr.server";

/** A fake compliance store that records calls — exercises the ops with no DB. */
class FakeStore implements ComplianceStore {
  deletedShops: string[] = [];
  deletedCustomers: Array<{ shop: string; customerId: string }> = [];
  collected: Array<{ shop: string; customerId: string }> = [];

  constructor(
    private readonly sessionCount = 3,
    private readonly customerRecords: unknown[] = [],
  ) {}

  async deleteShopSessions(shop: string): Promise<number> {
    this.deletedShops.push(shop);
    return this.sessionCount;
  }
  async deleteCustomerData(shop: string, customerId: string): Promise<number> {
    this.deletedCustomers.push({ shop, customerId });
    return this.customerRecords.length;
  }
  async collectCustomerData(shop: string, customerId: string): Promise<unknown[]> {
    this.collected.push({ shop, customerId });
    return this.customerRecords;
  }
}

const SHOP = "acme.myshopify.com";

describe("payload extraction", () => {
  it("reads the customer id (coercing numeric ids to strings)", () => {
    expect(extractCustomerId({ customer: { id: 991 } })).toBe("991");
    expect(extractCustomerId({ customer: { id: "c_1" } })).toBe("c_1");
  });

  it("returns undefined for shop-only or malformed payloads", () => {
    expect(extractCustomerId({ shop_domain: SHOP })).toBeUndefined();
    expect(extractCustomerId(null)).toBeUndefined();
    expect(extractCustomerId("nope")).toBeUndefined();
  });

  it("reads the data-request id", () => {
    expect(extractDataRequestId({ data_request: { id: 42 } })).toBe("42");
    expect(extractDataRequestId({})).toBeUndefined();
  });
});

describe("redactShop", () => {
  it("deletes the shop's sessions and reports the count", async () => {
    const store = new FakeStore(5);
    const result = await redactShop(store, SHOP);
    expect(result).toEqual({ shop: SHOP, sessionsDeleted: 5 });
    expect(store.deletedShops).toEqual([SHOP]);
  });
});

describe("redactCustomer", () => {
  it("deletes customer PII when a customer id is present", async () => {
    const store = new FakeStore(0, [{ email: "x" }]);
    const result = await redactCustomer(store, SHOP, "c_1");
    expect(result.piiRecordsDeleted).toBe(1);
    expect(store.deletedCustomers).toEqual([{ shop: SHOP, customerId: "c_1" }]);
  });

  it("is a no-op when the payload carries no customer id", async () => {
    const store = new FakeStore();
    const result = await redactCustomer(store, SHOP, undefined);
    expect(result.piiRecordsDeleted).toBe(0);
    expect(store.deletedCustomers).toEqual([]); // store never touched
  });
});

describe("collectCustomerData", () => {
  it("returns the records the store holds for the customer", async () => {
    const store = new FakeStore(0, [{ order: 1 }, { order: 2 }]);
    const result = await collectCustomerData(store, SHOP, "c_9");
    expect(result.records).toHaveLength(2);
    expect(store.collected).toEqual([{ shop: SHOP, customerId: "c_9" }]);
  });

  it("returns nothing when no customer id is supplied", async () => {
    const store = new FakeStore();
    const result = await collectCustomerData(store, SHOP, undefined);
    expect(result.records).toEqual([]);
    expect(store.collected).toEqual([]);
  });
});
