# TryMerchantAI — Internal Documentation

> The AI Commerce Operating System for Shopify.
> Long-term vision: the autonomous AI employee that operates an entire ecommerce business.

**Website:** https://TryMerchantAI.com
**Repo package name:** `try-merchant-ai`
**Owner:** G7
**Doc status:** Living documentation — treat as the single source of truth (SSOT). If code and docs disagree, fix whichever is wrong and note it in the changelog of the affected doc.

---

## 0. What this repository is

This `/docs` tree is the **company operating manual** for TryMerchantAI: product, business, design, engineering, AI, security, compliance, and operations. It is written to the standard a Series-A/B VC-backed SaaS company would hold — every document is authoritative, versioned, and actionable.

It is **not** marketing copy. It is the internal contract between founders, engineers, designers, reviewers, and future hires.

## 1. Ground-truth technical baseline (as of 2026-07-10)

The documentation is grounded in the **actual** repository state, not an idealized one. Do not trust generic "Shopify Remix" assumptions — this project has already moved to the current template.

| Concern | Current reality | Target (documented migration) |
|---|---|---|
| App framework | **React Router 7** (`@react-router/*@7.12`) via `@shopify/shopify-app-react-router@1.1` | Same — React Router 7 is the go-forward. Remix is deprecated by Shopify. |
| Runtime | Node.js `>=20.19 <22 || >=22.12`, ESM (`"type": "module"`) | Node 22 LTS on all environments |
| Shopify API version | `2025-10` (`ApiVersion.October25`) | Roll forward quarterly, pinned per release |
| Database | **SQLite** (`prisma/schema.prisma`), single `Session` model | **PostgreSQL 16** (managed) — see `18_DATABASE_SCHEMA.md` |
| Session storage | `@shopify/shopify-app-session-storage-prisma@9` | Same, backed by Postgres |
| Queue / jobs | none | **Redis 7 + BullMQ** — see `17_AUTOMATION_ENGINE.md` |
| AI providers | none | **Anthropic (Claude) primary, OpenAI secondary**, MCP tool layer — see `16_AI_AGENT_ARCHITECTURE.md` |
| Distribution | `AppDistribution.AppStore` | Public app, App Store listed |
| Access scopes | `write_products, write_metaobjects, write_metaobject_definitions` | Expanded per feature, least-privilege — see `26_PERMISSION_SYSTEM.md` |
| Offline tokens | `future.expiringOfflineAccessTokens: true` enabled | Keep; implement refresh handling — see `25_AUTHENTICATION.md` |
| Deployment | local dev + Cloudflare tunnel | Docker + Fly.io/Render + Cloudflare — see `37_DEVOPS.md`, `38_DEPLOYMENT.md` |

**Already completed (do not redo):** App init, Shopify CLI, OAuth, local dev, embedded app, installed on a development store.

**Explicitly forbidden:** Re-initializing the app, creating a second Shopify app, destroying existing architecture. All work is *continuation* of this project.

## 2. Documentation map

| # | File | Domain | Primary owner |
|---|---|---|---|
| — | `README.md` | Index / baseline | CTO |
| 00 | `00_MASTER_PROMPT.md` | Operating charter for humans + AI agents | CEO/CTO |
| 01 | `01_PRODUCT_VISION.md` | Vision, mission, wedge, north star | CEO/PM |
| 02 | `02_BUSINESS_STRATEGY.md` | GTM, pricing, unit economics, moat | CEO |
| 03 | `03_COMPETITOR_ANALYSIS.md` | Landscape, positioning | Growth PM |
| 04 | `04_MARKET_RESEARCH.md` | TAM/SAM/SOM, ICP, demand | Growth PM |
| 05 | `05_BRAND_GUIDELINES.md` | Voice, logo, color, type | Brand/Design |
| 06 | `06_PRD.md` | Product requirements (MVP → V1) | PM |
| 07 | `07_FEATURE_SPECIFICATION.md` | Feature-level specs | PM/Eng |
| 08 | `08_USER_PERSONAS.md` | Personas, JTBD | PM |
| 09 | `09_USER_FLOW.md` | End-to-end flows | UX |
| 10 | `10_INFORMATION_ARCHITECTURE.md` | Nav, IA, routes | UX |
| 11 | `11_UI_UX_GUIDELINES.md` | Interaction + Polaris rules | Design |
| 12 | `12_FIGMA_DESIGN_SYSTEM.md` | Design tokens, Figma structure | Design |
| 13 | `13_COMPONENT_LIBRARY.md` | Component contracts | FE Eng |
| 14 | `14_DASHBOARD_SPECIFICATION.md` | Home/dashboard spec | PM/FE |
| 15 | `15_AI_CHAT_SPEC.md` | Copilot chat UX + protocol | AI Eng |
| 16 | `16_AI_AGENT_ARCHITECTURE.md` | Agent runtime, 12 agents | AI Architect |
| 17 | `17_AUTOMATION_ENGINE.md` | Workflows, jobs, BullMQ | Backend |
| 18 | `18_DATABASE_SCHEMA.md` | Postgres schema, Prisma | DB Architect |
| 19 | `19_API_ARCHITECTURE.md` | Internal + external APIs | Backend |
| 20 | `20_BACKEND_ARCHITECTURE.md` | Services, boundaries | Backend |
| 21 | `21_FRONTEND_ARCHITECTURE.md` | RR7, data loading | FE Eng |
| 22 | `22_SHOPIFY_INTEGRATION.md` | Admin GraphQL, extensions | Shopify SA |
| 23 | `23_THEME_APP_EXTENSION.md` | Storefront blocks | Shopify SA |
| 24 | `24_WEBHOOKS.md` | Topics, HMAC, GDPR | Backend |
| 25 | `25_AUTHENTICATION.md` | OAuth, session tokens | Security |
| 26 | `26_PERMISSION_SYSTEM.md` | Scopes, RBAC, plans | Security |
| 27 | `27_SUBSCRIPTION_BILLING.md` | Billing API, plans, metering | PM/Backend |
| 28 | `28_NOTIFICATION_SYSTEM.md` | In-app, email, digest | Backend |
| 29 | `29_ANALYTICS_ENGINE.md` | Event pipeline, metrics | Data |
| 30 | `30_REPORTING_SYSTEM.md` | Reports, exports | Data |
| 31 | `31_AI_MEMORY_SYSTEM.md` | Vector + structured memory | AI Architect |
| 32 | `32_SECURITY.md` | Threat model, controls | Security |
| 33 | `33_PERFORMANCE.md` | Budgets, Web Vitals | Eng |
| 34 | `34_ACCESSIBILITY.md` | WCAG 2.2 AA | Design/FE |
| 35 | `35_SEO.md` | App + storefront SEO | Growth |
| 36 | `36_TESTING.md` | Test strategy, pyramid | QA/Eng |
| 37 | `37_DEVOPS.md` | CI/CD, infra as code | DevOps |
| 38 | `38_DEPLOYMENT.md` | Environments, releases | DevOps |
| 39 | `39_MONITORING.md` | Observability, SLOs | DevOps |
| 40 | `40_ERROR_HANDLING.md` | Error taxonomy, recovery | Eng |
| 41 | `41_LOGGING.md` | Structured logs, retention | Eng |
| 42 | `42_BACKUP.md` | Backup/restore, DR | DevOps |
| 43 | `43_APP_STORE_APPROVAL.md` | Review checklist | Shopify Review |
| 44 | `44_PRIVACY_POLICY.md` | Privacy policy | Legal |
| 45 | `45_TERMS.md` | Terms of service | Legal |
| 46 | `46_COOKIE_POLICY.md` | Cookie policy | Legal |
| 47 | `47_SUPPORT_SYSTEM.md` | Support ops, SLAs | Support |
| 48 | `48_MAINTENANCE_GUIDE.md` | Runbooks | Eng |
| 49 | `49_RELEASE_PROCESS.md` | Versioning, changelog | Eng |
| 50 | `50_FUTURE_ROADMAP.md` | 12–36 month roadmap | CEO |

## 3. How to read these docs

- **New engineer?** Read `README.md` → `00` → `20` → `21` → `18` → `22`.
- **New PM/designer?** Read `01` → `06` → `08` → `09` → `11` → `12`.
- **Shipping AI?** Read `16` → `15` → `31` → `17`.
- **Prepping App Store submission?** Read `43` → `24` → `25` → `26` → `27` → `32` → `44–46`.

## 4. Document conventions

- Every doc opens with **Purpose / Goals** and closes with **Edge Cases, Security, Testing, Maintenance, Future Expansion** where applicable (per the company documentation standard).
- **RFC-2119 keywords** (MUST / SHOULD / MAY) carry normative weight.
- Code identifiers use `monospace`. File references use `path:line`.
- Decisions of record are logged as **ADRs** inside the relevant doc under an `## Decisions (ADR)` heading.
- Dates are absolute (ISO-8601). No "next quarter" — write the quarter.

## 5. Changelog

| Date | Change | Author |
|---|---|---|
| 2026-07-10 | Initial documentation repository created; baseline corrected from "Remix" to actual React Router 7 stack; SQLite→Postgres migration path documented. | Founding team (AI) |
