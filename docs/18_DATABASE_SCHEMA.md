# 18 — Database Schema

## Purpose
Define the data model, the SQLite→PostgreSQL migration, and Prisma conventions. Grounds all persistence for sessions, agents, findings, actions, audit, chat, memory, billing, and analytics.

## Current reality (ground truth)
`prisma/schema.prisma` today: `provider = "sqlite"`, `url = "file:dev.sqlite"`, single `Session` model (from the template). That is a **dev scaffold only**. Production requires PostgreSQL and the full schema below.

## Goals
- Migrate to **PostgreSQL 16** (managed) with zero data model surprises.
- A normalized, tenant-isolated, index-optimized schema that scales to 10k+ shops.
- Strong audit + reversibility support (`00` P3).

## Datastore decisions
- **PostgreSQL 16** — primary OLTP store (Prisma).
- **Redis 7** — queue/cache/locks (`17`), not source of truth.
- **pgvector** extension (or a managed vector store) for AI memory embeddings (`31`).
- **Object storage** (S3-compatible) for large artifacts/exports (`42`).
- Analytics events may stream to an append-only table + optional warehouse later (`29`).

### Migration: SQLite → Postgres
1. Change datasource `provider` to `postgresql`, `url = env("DATABASE_URL")`.
2. Keep `Session` shape (Shopify session storage adapter contract) — it must remain compatible with `@shopify/shopify-app-session-storage-prisma`.
3. Add new models (below). Generate a baseline migration; deploy via `prisma migrate deploy` (already in `setup` script).
4. Enable `pgvector`; add embedding columns/tables.
5. Backfill not needed (dev sqlite is disposable). Production starts clean on Postgres.
> Do NOT keep sqlite for production. Do NOT alter the `Session` model's required fields used by the adapter.

## Conventions
- Tenant key: every non-global table has `shop` (String, indexed). All queries filter by `shop` (isolation, `32`).
- IDs: `cuid()`/`uuid` for our entities; store Shopify GIDs as strings.
- Timestamps: `createdAt`/`updatedAt` on every table.
- Soft-delete via `deletedAt` where retention/audit matters; hard-delete for GDPR redaction (`44`).
- Money as integer minor units + currency code; never floats.
- Enums for status fields; JSON columns for flexible payloads (validated at app layer).
- Indexes on every foreign key + common filter (shop, status, createdAt).

## Core models (Prisma sketch)

```prisma
// --- Shopify session (KEEP compatible with adapter) ---
model Session { /* existing fields retained; see prisma/schema.prisma */ }

// --- Tenant / shop profile ---
model Shop {
  id            String   @id @default(cuid())
  domain        String   @unique          // myshop.myshopify.com
  planTier      PlanTier @default(FREE)
  installedAt   DateTime @default(now())
  uninstalledAt DateTime?
  settings      Json                       // autonomy defaults, prefs
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([domain])
}

// --- Agents & runtime state ---
model AgentState {
  id           String     @id @default(cuid())
  shop         String
  agentId      String     // 'seo' | 'cro' | ...
  trustLevel   TrustLevel @default(SUGGEST)
  enabled      Boolean    @default(true)
  budgetDaily  Int        // AAC
  lastRunAt    DateTime?
  status       AgentStatus @default(IDLE)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([shop, agentId])
  @@index([shop])
}

// --- Store Health scans & findings ---
model ScanRun {
  id         String   @id @default(cuid())
  shop       String
  status     ScanStatus @default(RUNNING)
  startedAt  DateTime @default(now())
  finishedAt DateTime?
  summary    Json?
  findings   Finding[]
  @@index([shop, startedAt])
}
model Finding {
  id          String   @id @default(cuid())
  shop        String
  scanRunId   String
  scanRun     ScanRun  @relation(fields: [scanRunId], references: [id])
  domain      String   // seo|cro|content|catalog|perf|inventory
  severity    Severity
  title       String
  rationale   String
  estImpact   Json     // metric + value + confidence
  effort      Int
  status      FindingStatus @default(OPEN) // open|dismissed|snoozed|resolved
  actionType  String?  // typed action id
  actionArgs  Json?
  createdAt   DateTime @default(now())
  @@index([shop, status, severity])
  @@index([scanRunId])
}

// --- Actions & audit (reversibility spine) ---
model ActionRecord {
  id           String   @id @default(cuid())
  shop         String
  agentId      String?
  actorType    ActorType // agent | human | system
  type         String    // typed action id
  args         Json
  status       ActionStatus @default(PENDING) // pending|previewed|approved|executing|done|failed|reverted
  reversible   Boolean
  beforeState  Json?
  afterState   Json?
  undoToken    String?
  error        Json?
  traceId      String
  createdAt    DateTime @default(now())
  executedAt   DateTime?
  @@index([shop, status, createdAt])
}
model AuditLog {          // immutable, append-only
  id         String   @id @default(cuid())
  shop       String
  actorType  ActorType
  actorId    String?
  event      String
  target     String?  // resource GID
  before     Json?
  after      Json?
  traceId    String
  createdAt  DateTime @default(now())
  @@index([shop, createdAt])
}

// --- Automations ---
model Automation {
  id         String   @id @default(cuid())
  shop       String
  name       String
  trigger    Json     // schedule|webhook|event
  agentId    String
  taskConfig Json
  trustLevel TrustLevel
  guardrails Json     // caps, allowlist, quiet hours
  enabled    Boolean  @default(true)
  createdAt  DateTime @default(now())
  runs       AutomationRun[]
  @@index([shop, enabled])
}
model AutomationRun {
  id           String   @id @default(cuid())
  shop         String
  automationId String
  automation   Automation @relation(fields: [automationId], references: [id])
  status       String
  startedAt    DateTime @default(now())
  finishedAt   DateTime?
  result       Json?
  @@index([automationId, startedAt])
}

// --- Copilot chat ---
model ChatSession {
  id        String   @id @default(cuid())
  shop      String
  title     String?
  createdAt DateTime @default(now())
  messages  ChatMessage[]
  @@index([shop, createdAt])
}
model ChatMessage {
  id            String   @id @default(cuid())
  shop          String
  chatSessionId String
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id])
  role          String   // user|assistant|system|tool
  content       Json     // text + tool calls + citations
  tokens        Int?
  createdAt     DateTime @default(now())
  @@index([chatSessionId, createdAt])
}

// --- AI memory (see 31) ---
model MemoryItem {
  id         String   @id @default(cuid())
  shop       String
  scope      String   // agentId or 'shop'
  kind       String   // fact|preference|baseline|summary
  content    String
  embedding  Unsupported("vector")?  // pgvector
  metadata   Json?
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  @@index([shop, scope, kind])
}

// --- Billing / metering (see 27) ---
model Subscription {
  id            String   @id @default(cuid())
  shop          String   @unique
  planTier      PlanTier
  shopifyChargeId String?
  status        String
  currentPeriodEnd DateTime?
  createdAt     DateTime @default(now())
}
model UsageRecord {
  id        String   @id @default(cuid())
  shop      String
  metric    String   // 'aac'
  quantity  Int
  agentId   String?
  createdAt DateTime @default(now())
  @@index([shop, createdAt])
}

// --- Analytics events (see 29) ---
model Event {
  id        String   @id @default(cuid())
  shop      String
  name      String
  props     Json
  traceId   String?
  createdAt DateTime @default(now())
  @@index([shop, name, createdAt])
}
```
Enums: `PlanTier`, `TrustLevel`, `AgentStatus`, `ScanStatus`, `Severity`, `FindingStatus`, `ActionStatus`, `ActorType`.

## Indexing & performance (`33`)
- Composite indexes on `(shop, status, createdAt)` for list/filter queries.
- Avoid unbounded scans; always paginate (cursor-based) + filter by shop.
- Partition/retention for high-volume `Event`, `AuditLog`, `AutomationRun` (time-based cleanup `42`).
- Connection pooling (PgBouncer/managed) sized to worker + web concurrency.

## Data integrity
- Foreign keys + cascade rules deliberate (cascade delete children on shop redaction; restrict on audit).
- App-layer validation for JSON columns (schemas); DB constraints where possible.
- Transactions for multi-write invariants (action + audit written atomically).

## Security & privacy (`32`,`44`)
- Tenant isolation enforced in every query (shop filter) — consider Postgres RLS as defense-in-depth later.
- PII minimized; encrypt sensitive columns/at-rest (managed encryption); secrets never in DB.
- GDPR redaction: `customers/redact`, `shop/redact`, `customers/data_request` map to concrete delete/export routines across all shop-scoped tables (`24`,`44`).

## Backup & retention (`42`)
- Automated PITR backups; tested restores; retention timers post-uninstall; audit logs retained per policy; analytics/events aged out.

## Edge cases
- Large catalogs → we store aggregates/findings, not full catalog mirrors; fetch live from Shopify (`22`).
- Schema migrations under load → expand/contract pattern, no destructive online migrations without backfill plan.
- Multi-region (future) → shard by shop; keep shop as the partition key from day one.

## Testing (`36`)
Migration tests (sqlite→pg parity for Session), constraint tests, isolation tests (no cross-shop leakage), redaction tests (redact removes all PII), and query performance tests on seeded 10k-shop dataset.

## Maintenance
Owned by DB Architect. Every schema change = a reviewed Prisma migration + doc update here + isolation/redaction test. Never edit a shipped migration; add a new one.

## Decisions (ADR)
- **ADR-018-1:** PostgreSQL 16 is the production datastore; SQLite is dev-only.
- **ADR-018-2:** `shop` is the mandatory tenant key on all shop-scoped tables from day one (future sharding).
- **ADR-018-3:** `AuditLog` is append-only/immutable; reversibility data lives on `ActionRecord`.
