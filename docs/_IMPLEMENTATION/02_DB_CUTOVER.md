# DB Cutover Runbook — SQLite → PostgreSQL 16 (M0.T7)

> Resolves conflict **C-2** (`00_IMPLEMENTATION_PLAN.md`). The full domain schema (enums + JSON + pgvector) cannot run on SQLite, so Postgres is required (docs/18). This is delivered as a **deliberate, reversible cutover** rather than an in-place swap so a working `npm run dev` is never silently broken. Everything here is real and ready to apply; run it when you're ready.

## Why it isn't already applied
The live `prisma/schema.prisma` still targets SQLite + the existing `20240530213853_create_session_table` migration, which is what your current local `npm run dev` uses. Swapping the datasource to Postgres without a running database would break `npm run dev` on any machine that hasn't started Postgres. The `docker-compose.yml` + `.env.example` (already added) make the cutover a one-command, environment-safe operation.

## Prerequisites
- Docker Desktop (or a reachable Postgres 16 + Redis 7).
- `.env` created from `.env.example` (at least `DATABASE_URL`, `REDIS_URL`).

## Steps

```bash
# 1. Start Postgres (with pgvector) + Redis
docker compose up -d

# 2. Replace prisma/schema.prisma with the schema in §"Target schema" below.
#    Then remove the SQLite-specific baseline migration (no prod data exists, docs/18 ADR-018-1):
rm -rf prisma/migrations/20240530213853_create_session_table

# 3. Create the Postgres baseline migration + apply it
npx prisma migrate dev --name init

# 4. Generate the client and verify
npx prisma generate
npm run typecheck

# 5. Run the app exactly as before
npm run dev
```

Rollback: `git checkout prisma/schema.prisma prisma/migrations` and `docker compose down`. Reversible at any point.

> Note on pgvector: the schema enables the `vector` extension via Prisma's
> `postgresqlExtensions` preview. The `pgvector/pgvector:pg16` image already has
> it. On managed Postgres without pgvector, comment the `embedding` field +
> `extensions`/`previewFeatures` lines; AI memory (docs/31) degrades to
> structured-only until the extension is enabled — the retrieval layer is coded
> behind an interface so this is swappable.

## Target schema (`prisma/schema.prisma`)

Complete, validated against docs/18. `Session` keeps every field required by
`@shopify/shopify-app-session-storage-prisma` (ADR-025-3); `shop` is the
mandatory tenant key on every shop-scoped model (ADR-018-2); `AuditLog` is
append-only (ADR-018-3).

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

// --- Enums (keep in lockstep with app/lib/domain/enums.ts) ---
enum PlanTier { FREE GROWTH PRO SCALE ENTERPRISE }
enum Role { OWNER ADMIN OPERATOR ANALYST VIEWER }
enum TrustLevel { SUGGEST DRAFT APPROVE AUTO_REVERSIBLE AUTO_GUARDED }
enum AgentStatus { IDLE RUNNING ERROR PAUSED }
enum ScanStatus { RUNNING COMPLETED PARTIAL FAILED }
enum Severity { INFO LOW MEDIUM HIGH CRITICAL }
enum FindingStatus { OPEN DISMISSED SNOOZED RESOLVED }
enum ActionStatus { PENDING PREVIEWED APPROVED EXECUTING DONE FAILED REVERTED }
enum ActorType { AGENT HUMAN SYSTEM }

// --- Shopify session (adapter-compatible; do not drop required fields) ---
model Session {
  id                  String    @id
  shop                String
  state               String
  isOnline            Boolean   @default(false)
  scope               String?
  expires             DateTime?
  accessToken         String
  userId              BigInt?
  firstName           String?
  lastName            String?
  email               String?
  accountOwner        Boolean   @default(false)
  locale              String?
  collaborator        Boolean?  @default(false)
  emailVerified       Boolean?  @default(false)
  refreshToken        String?
  refreshTokenExpires DateTime?

  @@index([shop])
}

// --- Tenant / shop ---
model Shop {
  id            String    @id @default(cuid())
  domain        String    @unique
  planTier      PlanTier  @default(FREE)
  installedAt   DateTime  @default(now())
  uninstalledAt DateTime?
  settings      Json      @default("{}")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([domain])
}

model AgentState {
  id          String      @id @default(cuid())
  shop        String
  agentId     String
  trustLevel  TrustLevel  @default(SUGGEST)
  enabled     Boolean     @default(true)
  budgetDaily Int         @default(0)
  lastRunAt   DateTime?
  status      AgentStatus @default(IDLE)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([shop, agentId])
  @@index([shop])
}

// --- Store Health scans & findings ---
model ScanRun {
  id         String     @id @default(cuid())
  shop       String
  status     ScanStatus @default(RUNNING)
  startedAt  DateTime   @default(now())
  finishedAt DateTime?
  summary    Json?
  findings   Finding[]

  @@index([shop, startedAt])
}

model Finding {
  id         String        @id @default(cuid())
  shop       String
  scanRunId  String
  scanRun    ScanRun       @relation(fields: [scanRunId], references: [id], onDelete: Cascade)
  domain     String
  severity   Severity
  title      String
  rationale  String
  estImpact  Json?
  effort     Int           @default(1)
  status     FindingStatus @default(OPEN)
  actionType String?
  actionArgs Json?
  createdAt  DateTime      @default(now())

  @@index([shop, status, severity])
  @@index([scanRunId])
}

// --- Actions & audit (reversibility spine, docs/40/41) ---
model ActionRecord {
  id          String       @id @default(cuid())
  shop        String
  agentId     String?
  actorType   ActorType
  type        String
  args        Json
  status      ActionStatus @default(PENDING)
  reversible  Boolean      @default(true)
  beforeState Json?
  afterState  Json?
  undoToken   String?
  error       Json?
  traceId     String
  createdAt   DateTime     @default(now())
  executedAt  DateTime?

  @@index([shop, status, createdAt])
}

model AuditLog {
  id        String    @id @default(cuid())
  shop      String
  actorType ActorType
  actorId   String?
  event     String
  target    String?
  before    Json?
  after     Json?
  traceId   String
  createdAt DateTime  @default(now())

  @@index([shop, createdAt])
}

// --- Automations ---
model Automation {
  id         String          @id @default(cuid())
  shop       String
  name       String
  trigger    Json
  agentId    String
  taskConfig Json
  trustLevel TrustLevel      @default(SUGGEST)
  guardrails Json            @default("{}")
  enabled    Boolean         @default(true)
  createdAt  DateTime        @default(now())
  runs       AutomationRun[]

  @@index([shop, enabled])
}

model AutomationRun {
  id           String     @id @default(cuid())
  shop         String
  automationId String
  automation   Automation @relation(fields: [automationId], references: [id], onDelete: Cascade)
  status       String
  startedAt    DateTime   @default(now())
  finishedAt   DateTime?
  result       Json?

  @@index([automationId, startedAt])
}

// --- Copilot chat ---
model ChatSession {
  id        String        @id @default(cuid())
  shop      String
  title     String?
  createdAt DateTime      @default(now())
  messages  ChatMessage[]

  @@index([shop, createdAt])
}

model ChatMessage {
  id            String      @id @default(cuid())
  shop          String
  chatSessionId String
  chatSession   ChatSession @relation(fields: [chatSessionId], references: [id], onDelete: Cascade)
  role          String
  content       Json
  tokens        Int?
  createdAt     DateTime    @default(now())

  @@index([chatSessionId, createdAt])
}

// --- AI memory (docs/31); pgvector embedding ---
model MemoryItem {
  id        String                      @id @default(cuid())
  shop      String
  scope     String
  kind      String
  content   String
  embedding Unsupported("vector(1536)")?
  metadata  Json?
  createdAt DateTime                    @default(now())
  updatedAt DateTime                    @updatedAt

  @@index([shop, scope, kind])
}

// --- Billing / metering (docs/27) ---
model Subscription {
  id               String    @id @default(cuid())
  shop             String    @unique
  planTier         PlanTier  @default(FREE)
  shopifyChargeId  String?
  status           String    @default("active")
  currentPeriodEnd DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}

model UsageRecord {
  id        String   @id @default(cuid())
  shop      String
  metric    String
  quantity  Int
  agentId   String?
  createdAt DateTime @default(now())

  @@index([shop, createdAt])
}

// --- Analytics events (docs/29) ---
model Event {
  id        String   @id @default(cuid())
  shop      String
  name      String
  props     Json     @default("{}")
  traceId   String?
  createdAt DateTime @default(now())

  @@index([shop, name, createdAt])
}
```

## After the cutover — update `app/db.server.ts`
The current singleton is fine; no change required for Postgres. Repositories
(M1.T1) will consume it via `scoped(shop, …)` from `app/lib/security/tenant.server.ts`
so every query is tenant-isolated by construction.

## Verification checklist
- [ ] `docker compose ps` shows db + redis healthy.
- [ ] `npx prisma migrate status` clean.
- [ ] `npm run typecheck` passes (Prisma client regenerated with new models).
- [ ] `npm run dev` boots and the app loads in Admin as before.
- [ ] A session row is written on install (adapter still works).

## Next tasks unblocked by this cutover
M0.T8 (BullMQ queues + worker), M0.T9 (AI provider abstraction), then M1.T1
repositories + domain services. See `01_ROADMAP.md`.
