import { AppError } from "../../errors";
import type { Shop } from "../../security/tenant.server";
import type {
  ActionStore,
  AuditPort,
  BudgetPort,
  LockPort,
  StoredAction,
} from "../action-pipeline.server";
import { newId } from "../../ids";

/**
 * Process-lifetime, in-memory implementations of the action-pipeline ports
 * (docs/16, docs/40). They let the reversibility spine run end-to-end — preview
 * → approve → execute → undo, with real locking, auditing, and budgeting —
 * before the Postgres + Redis cutover (M0.T7) swaps in Prisma/Redis adapters.
 *
 * These are NOT mocks: the orchestration, tenant isolation, single-writer
 * serialization, and audit trail are real. What is deliberately bounded is
 * durability and horizontal scale — state lives in this Node process, so it is
 * lost on restart and is single-instance only. That is exactly the gap the DB
 * cutover closes; the port contracts here are unchanged when it lands.
 */

/* ----------------------------------------------------------- Action store -- */

/**
 * A shop-scoped action store backed by a Map. Reads and writes are validated
 * against the owning shop so a cross-tenant id can never resolve (docs/32).
 */
export class InMemoryActionStore implements ActionStore {
  private readonly rows = new Map<string, StoredAction>();

  async create(input: Omit<StoredAction, "id">): Promise<StoredAction> {
    const row = { ...input, id: newId("act") } as StoredAction;
    this.rows.set(row.id, row);
    return row;
  }

  async get(shop: Shop, id: string): Promise<StoredAction | null> {
    const row = this.rows.get(id);
    return row && row.shop === shop ? row : null;
  }

  async update(
    shop: Shop,
    id: string,
    patch: Partial<Omit<StoredAction, "id" | "shop">>,
  ): Promise<StoredAction> {
    const row = this.rows.get(id);
    if (!row || row.shop !== shop) {
      throw new AppError("NOT_FOUND", { details: { reason: "action_not_found" } });
    }
    const next = { ...row, ...patch } as StoredAction;
    this.rows.set(id, next);
    return next;
  }

  /** All actions for a shop, in creation order (for reflecting fix state in UI). */
  async list(shop: Shop): Promise<StoredAction[]> {
    const out: StoredAction[] = [];
    for (const row of this.rows.values()) {
      if (row.shop === shop) out.push(row);
    }
    return out;
  }
}

/* ------------------------------------------------------------- Audit log --- */

export interface AuditRecord {
  readonly seq: number;
  readonly shop: string;
  readonly actorType: string;
  readonly actorId?: string;
  readonly event: string;
  readonly target?: string;
  readonly before?: unknown;
  readonly after?: unknown;
  readonly traceId: string;
}

/**
 * A bounded, append-only audit log. A monotonic `seq` gives a stable ordering
 * without a clock, so tests are deterministic; the persisted audit table
 * (docs/41) supersedes this with durable, timestamped rows.
 */
export class InMemoryAuditLog implements AuditPort {
  private readonly entries: AuditRecord[] = [];
  private seq = 0;

  constructor(private readonly maxEntries = 500) {}

  async record(entry: Parameters<AuditPort["record"]>[0]): Promise<void> {
    this.entries.push({ seq: ++this.seq, ...entry });
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
  }

  /** The most recent `limit` audit records for a shop, newest first. */
  list(shop: string, limit = 20): AuditRecord[] {
    const out: AuditRecord[] = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < limit; i--) {
      if (this.entries[i].shop === shop) out.push(this.entries[i]);
    }
    return out;
  }
}

/* ----------------------------------------------------------------- Lock --- */

/**
 * A per-key single-writer mutex (docs/16 "single-writer lock per resource").
 * Concurrent `withLock` calls for the same key run strictly one at a time in
 * arrival order; different keys run concurrently. Distributed locking (Redis)
 * replaces this at the cutover; the contract is identical.
 */
export class KeyedMutexLock implements LockPort {
  private readonly tails = new Map<string, Promise<void>>();

  async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();

    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    // Extend the chain; `held` always resolves (released in finally), so the
    // chain never rejects and later waiters are never starved by a failure.
    const mine = previous.then(() => held);
    this.tails.set(key, mine);

    await previous;
    try {
      return await fn();
    } finally {
      release();
      // Drop the map entry once we are the tail, to bound memory.
      if (this.tails.get(key) === mine) this.tails.delete(key);
    }
  }
}

/* --------------------------------------------------------------- Budget ---- */

/**
 * A simple per-shop AI Action Credit meter (docs/27). It enforces a cumulative
 * ceiling per process lifetime — enough to exercise the budget gate in the
 * pipeline. The durable, daily-windowed, Redis-backed meter lands with the
 * cutover; `ensure`/`consume` keep the same signatures.
 */
export class InMemoryBudget implements BudgetPort {
  private readonly spent = new Map<string, number>();

  constructor(private readonly ceiling = 1000) {}

  async ensure(shop: Shop, aac: number): Promise<void> {
    if ((this.spent.get(shop) ?? 0) + aac > this.ceiling) {
      throw new AppError("BUDGET_EXCEEDED", {
        details: { ceiling: this.ceiling },
      });
    }
  }

  async consume(shop: Shop, aac: number): Promise<void> {
    this.spent.set(shop, (this.spent.get(shop) ?? 0) + aac);
  }

  /** Credits consumed by a shop so far (for surfacing usage in the UI). */
  used(shop: string): number {
    return this.spent.get(shop) ?? 0;
  }
}
