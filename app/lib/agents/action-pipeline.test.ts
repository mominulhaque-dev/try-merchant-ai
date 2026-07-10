import { describe, it, expect, beforeEach } from "vitest";
import {
  ActionPipeline,
  type ActionContext,
  type ActionDiff,
  type ActionStore,
  type AuditPort,
  type BudgetPort,
  type DiffPort,
  type ExecutorPort,
  type LockPort,
  type StoredAction,
} from "./action-pipeline.server";
import { AGENT_SPECS } from "./specs";
import { assertShop } from "../security/tenant.server";
import { newId } from "../ids";
import type { ActionProposal } from "./types";

/** In-memory ports — exercise the full orchestration with no DB or Shopify. */

class InMemoryStore implements ActionStore {
  readonly rows = new Map<string, StoredAction>();
  async create(input: Omit<StoredAction, "id">): Promise<StoredAction> {
    const row = { ...input, id: newId("act") } as StoredAction;
    this.rows.set(row.id, row);
    return row;
  }
  async get(shop: string, id: string): Promise<StoredAction | null> {
    const r = this.rows.get(id);
    return r && r.shop === shop ? r : null;
  }
  async update(
    shop: string,
    id: string,
    patch: Partial<Omit<StoredAction, "id" | "shop">>,
  ): Promise<StoredAction> {
    const r = this.rows.get(id);
    if (!r || r.shop !== shop) throw new Error("not found");
    const next = { ...r, ...patch } as StoredAction;
    this.rows.set(id, next);
    return next;
  }
}

class FakeDiff implements DiffPort {
  current: ActionDiff = {
    fields: [{ key: "seoTitle", before: "Old title", after: "New title" }],
    summary: "Update SEO title",
  };
  async compute(): Promise<ActionDiff> {
    return this.current;
  }
}

class FakeExecutor implements ExecutorPort {
  applied = 0;
  reverted = 0;
  async apply(): Promise<{ afterState: unknown; undoToken?: string }> {
    this.applied += 1;
    return { afterState: { seoTitle: "New title" }, undoToken: "undo-1" };
  }
  async revert(): Promise<void> {
    this.reverted += 1;
  }
}

class FakeAudit implements AuditPort {
  readonly events: Array<Parameters<AuditPort["record"]>[0]> = [];
  async record(entry: Parameters<AuditPort["record"]>[0]): Promise<void> {
    this.events.push(entry);
  }
}

const lock: LockPort = { withLock: (_key, fn) => fn() };
const budget: BudgetPort = { ensure: async () => {}, consume: async () => {} };

const shop = assertShop("test.myshopify.com");

function makeCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    shop,
    actorType: "HUMAN",
    traceId: "trace-1",
    spec: AGENT_SPECS.seo,
    unattended: false,
    grantedScopes: ["read_products", "write_products"],
    plan: "GROWTH",
    role: "OPERATOR",
    agentTrust: "APPROVE",
    ...overrides,
  };
}

const proposal: ActionProposal = {
  type: "product.updateSeo",
  args: { id: "gid://shopify/Product/1" },
  reversible: true,
  summary: "Update SEO title",
  requiredTrust: "APPROVE",
};

const requirement = {
  requiredScopes: ["write_products"],
  requiredPlan: "GROWTH" as const,
  minRole: "OPERATOR" as const,
  requiredTrust: "APPROVE" as const,
};

describe("ActionPipeline", () => {
  let store: InMemoryStore;
  let diff: FakeDiff;
  let executor: FakeExecutor;
  let audit: FakeAudit;
  let pipeline: ActionPipeline;

  beforeEach(() => {
    store = new InMemoryStore();
    diff = new FakeDiff();
    executor = new FakeExecutor();
    audit = new FakeAudit();
    pipeline = new ActionPipeline({ store, diff, executor, audit, lock, budget });
  });

  it("previews, executes, audits, and registers undo", async () => {
    const preview = await pipeline.preview(makeCtx(), proposal, AGENT_SPECS.seo, requirement);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.value.requiresApproval).toBe(true);
    expect(preview.value.action.status).toBe("PREVIEWED");

    const exec = await pipeline.execute(makeCtx(), preview.value.action.id);
    expect(exec.ok).toBe(true);
    if (!exec.ok) return;
    expect(exec.value.status).toBe("DONE");
    expect(exec.value.undoToken).toBe("undo-1");
    expect(executor.applied).toBe(1);
    expect(audit.events.some((e) => e.event.startsWith("action.executed"))).toBe(true);
  });

  it("is idempotent on repeated execute", async () => {
    const preview = await pipeline.preview(makeCtx(), proposal, AGENT_SPECS.seo, requirement);
    if (!preview.ok) throw new Error("preview failed");
    await pipeline.execute(makeCtx(), preview.value.action.id);
    const second = await pipeline.execute(makeCtx(), preview.value.action.id);
    expect(second.ok).toBe(true);
    expect(executor.applied).toBe(1); // not applied twice
  });

  it("undoes a completed reversible action", async () => {
    const preview = await pipeline.preview(makeCtx(), proposal, AGENT_SPECS.seo, requirement);
    if (!preview.ok) throw new Error("preview failed");
    await pipeline.execute(makeCtx(), preview.value.action.id);
    const undo = await pipeline.undo(makeCtx(), preview.value.action.id);
    expect(undo.ok).toBe(true);
    if (undo.ok) expect(undo.value.status).toBe("REVERTED");
    expect(executor.reverted).toBe(1);
  });

  it("blocks execution when the resource changed since preview (optimistic concurrency)", async () => {
    const preview = await pipeline.preview(makeCtx(), proposal, AGENT_SPECS.seo, requirement);
    if (!preview.ok) throw new Error("preview failed");
    diff.current = {
      fields: [{ key: "seoTitle", before: "Changed elsewhere", after: "New title" }],
      summary: "Update SEO title",
    };
    const exec = await pipeline.execute(makeCtx(), preview.value.action.id);
    expect(exec.ok).toBe(false);
    if (!exec.ok) expect(exec.error.code).toBe("CONFLICT");
    expect(executor.applied).toBe(0);
  });

  it("denies preview when policy fails (trust too low)", async () => {
    const preview = await pipeline.preview(
      makeCtx({ agentTrust: "SUGGEST" }),
      proposal,
      AGENT_SPECS.seo,
      requirement,
    );
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error.code).toBe("FORBIDDEN");
  });

  it("denies preview when a required scope is missing", async () => {
    const preview = await pipeline.preview(
      makeCtx({ grantedScopes: ["read_products"] }),
      proposal,
      AGENT_SPECS.seo,
      requirement,
    );
    expect(preview.ok).toBe(false);
    if (!preview.ok) expect(preview.error.code).toBe("SCOPE_MISSING");
  });
});
