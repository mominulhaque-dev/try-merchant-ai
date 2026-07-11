import { describe, it, expect } from "vitest";
import {
  InMemoryActionStore,
  InMemoryAuditLog,
  InMemoryBudget,
  KeyedMutexLock,
} from "./in-memory.server";
import type { StoredAction } from "../action-pipeline.server";
import { assertShop } from "../../security/tenant.server";
import { AppError } from "../../errors";

const shopA = assertShop("alpha.myshopify.com");
const shopB = assertShop("beta.myshopify.com");

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function baseAction(overrides: Partial<StoredAction> = {}): Omit<StoredAction, "id"> {
  return {
    shop: shopA,
    actorType: "HUMAN",
    type: "product.updateSeo",
    args: { findingId: "seo-missing-title" },
    status: "PREVIEWED",
    reversible: true,
    requirement: {
      requiredScopes: ["write_products"],
      requiredPlan: "GROWTH",
      minRole: "OPERATOR",
      requiredTrust: "APPROVE",
    },
    previewHash: "abc123",
    traceId: "trace-1",
    ...overrides,
  };
}

describe("InMemoryActionStore", () => {
  it("creates, gets, and updates within a shop", async () => {
    const store = new InMemoryActionStore();
    const created = await store.create(baseAction());
    expect(created.id).toMatch(/^act_/);

    const got = await store.get(shopA, created.id);
    expect(got?.status).toBe("PREVIEWED");

    const updated = await store.update(shopA, created.id, { status: "DONE" });
    expect(updated.status).toBe("DONE");
  });

  it("isolates tenants: another shop cannot read or update the row", async () => {
    const store = new InMemoryActionStore();
    const created = await store.create(baseAction());

    expect(await store.get(shopB, created.id)).toBeNull();
    await expect(store.update(shopB, created.id, { status: "DONE" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("lists only the requesting shop's actions", async () => {
    const store = new InMemoryActionStore();
    await store.create(baseAction({ shop: shopA }));
    await store.create(baseAction({ shop: shopA }));
    await store.create(baseAction({ shop: shopB }));

    expect((await store.list(shopA)).length).toBe(2);
    expect((await store.list(shopB)).length).toBe(1);
  });
});

describe("InMemoryAuditLog", () => {
  it("returns a shop's records newest-first and honors the limit", async () => {
    const audit = new InMemoryAuditLog();
    await audit.record({ shop: shopA, actorType: "HUMAN", event: "action.previewed", traceId: "t1" });
    await audit.record({ shop: shopB, actorType: "HUMAN", event: "other.shop", traceId: "t2" });
    await audit.record({ shop: shopA, actorType: "HUMAN", event: "action.executed", traceId: "t3" });

    const list = audit.list(shopA);
    expect(list.map((e) => e.event)).toEqual(["action.executed", "action.previewed"]);
    expect(audit.list(shopA, 1)).toHaveLength(1);
  });

  it("bounds retention to maxEntries", async () => {
    const audit = new InMemoryAuditLog(2);
    for (let i = 0; i < 5; i++) {
      await audit.record({ shop: shopA, actorType: "SYSTEM", event: `e${i}`, traceId: `t${i}` });
    }
    const list = audit.list(shopA, 10);
    expect(list).toHaveLength(2);
    expect(list[0].event).toBe("e4");
  });
});

describe("KeyedMutexLock", () => {
  it("serializes concurrent holders of the same key", async () => {
    const lock = new KeyedMutexLock();
    let active = 0;
    let maxActive = 0;
    const task = () =>
      lock.withLock("resource", async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        active--;
      });

    await Promise.all([task(), task(), task()]);
    expect(maxActive).toBe(1);
  });

  it("runs different keys concurrently", async () => {
    const lock = new KeyedMutexLock();
    let active = 0;
    let maxActive = 0;
    const task = (key: string) =>
      lock.withLock(key, async () => {
        active++;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        active--;
      });

    await Promise.all([task("a"), task("b"), task("c")]);
    expect(maxActive).toBeGreaterThan(1);
  });

  it("keeps serializing after a holder throws", async () => {
    const lock = new KeyedMutexLock();
    const order: string[] = [];
    const failing = lock
      .withLock("k", async () => {
        order.push("start-1");
        throw new AppError("INTERNAL");
      })
      .catch(() => order.push("caught-1"));
    const following = lock.withLock("k", async () => {
      order.push("start-2");
    });

    await Promise.all([failing, following]);
    expect(order).toEqual(["start-1", "caught-1", "start-2"]);
  });
});

describe("InMemoryBudget", () => {
  it("allows spend under the ceiling and blocks over it", async () => {
    const budget = new InMemoryBudget(3);
    await expect(budget.ensure(shopA, 2)).resolves.toBeUndefined();
    await budget.consume(shopA, 2);
    expect(budget.used(shopA)).toBe(2);

    await expect(budget.ensure(shopA, 2)).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
  });

  it("meters shops independently", async () => {
    const budget = new InMemoryBudget(10);
    await budget.consume(shopA, 4);
    expect(budget.used(shopA)).toBe(4);
    expect(budget.used(shopB)).toBe(0);
  });
});
