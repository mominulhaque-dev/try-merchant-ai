# 03 — Competitor Analysis

## Purpose
Map the competitive landscape, identify where TryMerchantAI wins and where it is exposed, and define positioning that survives contact with Shopify's own AI.

## Goals
- Honest assessment of substitutes (including "do nothing" and "hire a VA/agency").
- Clear wedge differentiation.
- A monitored watchlist with trigger conditions.

## Competitive frame
Merchants don't buy "an AI app"; they buy *outcomes* (more revenue, less work). Our competitors are anything that delivers those outcomes: point apps, agencies, freelancers, Shopify-native AI, horizontal AI tools, and inertia.

## Categories

### 1. Shopify-native AI (the gravity well)
**Shopify Magic / Sidekick.** Native, free, deeply integrated, single-shot generation (product descriptions, edits, Q&A) and a growing conversational admin assistant.
- **Their strength:** distribution, zero install, first-party trust, no COGS to merchant.
- **Their limit:** single-shot and single-surface; not a multi-agent operator with per-domain autonomy, persistent cross-domain memory, reversible execution pipelines, or outcome attribution across the store. Shopify tends to build broad primitives, not deep vertical operators.
- **Our move:** be the *orchestration + memory + proof* layer on top of the platform. Never compete on "generate a paragraph"; compete on "run the growth loop and prove the ROI." Treat Sidekick as a feature we can even complement.

### 2. All-in-one AI "store optimizers"
Emerging apps promising AI-driven SEO/CRO/optimization bundles.
- **Strength:** similar pitch, some traction.
- **Limit:** typically thin — a prompt wrapper over one domain, weak safety rails, no true agent autonomy, no memory, no reversible audit.
- **Our move:** out-engineer on depth (12 specialized agents), safety (trust ladder, audit), and proof (MAVD). Enterprise-grade rails are the differentiator.

### 3. Point apps (per domain)
- **SEO:** SEO Manager, Smart SEO, Yoast-style, TinyIMG (alt text/speed).
- **CRO / UX:** Vitals, ReConvert, upsell/bundle apps.
- **Email/SMS/Marketing:** Klaviyo, Omnisend, Mailchimp.
- **Reviews/UGC:** Judge.me, Loox, Okendo.
- **Support:** Gorgias, Tidio, Zendesk.
- **Analytics:** Triple Whale, Lifetimely, Polar.
- **Inventory:** Stocky, Inventory Planner.
- **Strength:** best-in-class depth per niche; entrenched.
- **Limit:** merchant must buy, learn, and stitch 8–12 tools; nothing orchestrates across them; "app fatigue."
- **Our move:** we are the *operator layer* that reduces app sprawl and coordinates outcomes. We will integrate with (not naively duplicate) entrenched leaders like Klaviyo where switching cost is high — orchestrate them via APIs rather than replace on day one.

### 4. Agencies & freelancers / VAs
- **Strength:** human judgment, full-service, trusted relationships.
- **Limit:** expensive ($1k–10k+/mo), slow, don't scale, forget context, no 24/7.
- **Our move:** position as "the AI ops team at 1/20th the cost, always on, with a memory that never leaves." Partner with agencies (they use us across clients) rather than purely displace.

### 5. Horizontal AI (ChatGPT, Claude, Gemini)
- **Strength:** powerful, cheap, familiar.
- **Limit:** no store context, no execution, no safety rails, manual copy-paste.
- **Our move:** context + execution + memory + reversibility inside Shopify is the entire gap we fill.

## Positioning statement
> For growth-focused Shopify merchants drowning in tools and tasks, **TryMerchantAI is the AI Commerce Operating System** that observes your store, recommends and safely executes improvements across every domain, and proves the ROI — unlike single-shot AI features or a stack of disconnected point apps, it is one trusted operator with memory, autonomy you control, and a full audit trail.

## Differentiation matrix

| Capability | Shopify Magic/Sidekick | AI "optimizer" apps | Point apps | Agencies | **TryMerchantAI** |
|---|---|---|---|---|---|
| Multi-domain (SEO+CRO+email+inventory+…) | Partial | Partial | No (single) | Yes | **Yes** |
| True agent autonomy (execute, not just draft) | Limited | Rare | Limited | Human | **Yes, trust-laddered** |
| Persistent per-shop memory | Limited | No | No | Human memory | **Yes (`31`)** |
| Reversible + audited actions | Partial | Rare | Varies | N/A | **Yes (`00` P3)** |
| Outcome attribution (proof of ROI) | No | Rare | Some | Reports | **Yes (MAVD)** |
| Shopify-native depth (extensions/Functions/Flow) | Native | Shallow | Varies | N/A | **Deep** |
| Cost | Free | $ | $$ (stacked) | $$$$ | **$–$$$** |

## Where we are exposed (honest)
- **Shopify expands Sidekick into orchestration.** Trigger: Sidekick ships cross-domain autonomous actions. Response: lean harder into memory, outcome proof, agency/multi-store, and enterprise governance; consider becoming a certified value-add.
- **A point-app incumbent (e.g., Klaviyo, Vitals) adds an agent layer** with their distribution + data. Response: integrate and orchestrate; win on breadth + neutrality across their competitors.
- **Trust incident industry-wide** sours merchants on autonomous AI. Response: safety-first brand, conservative defaults, visible audit.

## Watchlist & triggers (monitored quarterly)
- Shopify AI roadmap (Editions releases), Sidekick capabilities.
- Klaviyo / Triple Whale / Vitals AI announcements.
- New "AI store manager" App Store entrants + their review velocity.
- Frontier model pricing (affects our COGS + everyone's feasibility).

## Edge cases
- A competitor undercuts on price with a thin product → compete on proof and trust, not price.
- Shopify makes a capability free → move up-stack to orchestration/memory of that capability.

## Future expansion
As we add the agent marketplace (`50`), third parties build on us — turning potential competitors into ecosystem participants.

## Maintenance
Refreshed quarterly by Growth PM; watchlist triggers reviewed at each Shopify Edition. Material shifts → ADR in `00`.
