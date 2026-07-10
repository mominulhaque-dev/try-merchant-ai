# 01 — Product Vision

## Purpose
Define what TryMerchantAI is, why it must exist now, the wedge we enter through, and the long-term operating-system endgame. This is the document every roadmap decision is measured against.

## Goals
- A vision durable enough to guide three years of roadmap.
- A wedge concrete enough to ship in one quarter.
- A north-star metric that aligns every team.

## Mission
Build the world's best AI Commerce Operating System for Shopify.

## Vision (3–5 years)
Every Shopify merchant — from a solo founder to a 200-person brand — runs their store with an **AI operations team** that never sleeps. TryMerchantAI becomes the layer where the merchant states intent ("grow repeat purchase rate," "clear this season's inventory," "improve my product pages for search") and a coordinated fleet of AI agents plans, executes, measures, and reports — inside Shopify, with full auditability and reversible control.

The endgame is the **AI employee that manages an entire ecommerce business**: it watches the store 24/7, catches problems before the merchant does, proposes and runs experiments, drafts and sends campaigns, keeps the catalog and theme healthy, answers customers, and reports outcomes in plain language.

## Why now (why this is inevitable)
1. **Model capability crossed the threshold.** Frontier LLMs (Claude, GPT-class) can now reliably reason over structured commerce data and call typed tools — the missing ingredient for safe autonomy.
2. **Shopify became an API-complete platform.** Admin GraphQL, Functions, Theme App Extensions, Flow, Metaobjects, and the Billing API mean an app can now *do* nearly everything a merchant can do in Admin.
3. **Merchant labor is the bottleneck.** SMB merchants wear 12 hats and can afford zero specialists. The market has thousands of point apps but no *operator*.
4. **The "app fatigue" backlash.** Merchants are consolidating apps. The winner is not another single-purpose app; it's the OS that subsumes many.

## The wedge (how we enter)
We do **not** launch "an OS." We launch a **Store Health + AI Copilot** wedge:

- **Store Health Agent** continuously audits the store (SEO gaps, broken CRO patterns, missing alt text, thin product copy, inventory risks, theme performance) and produces a prioritized, plain-language action list with estimated impact.
- **AI Copilot chat** lets the merchant ask anything about their store and, with one click, turn a recommendation into an executed, reversible action.

This wedge is: immediately valuable on day one (no setup), demonstrates safe autonomy, generates the outcome data that becomes our moat, and naturally expands agent-by-agent into the full OS.

## Product pillars
1. **Observe** — a unified, always-fresh model of the store (catalog, orders, customers, theme, traffic, inventory) via Shopify APIs + our analytics engine (`29`).
2. **Reason** — the agent fleet (`16`) turns observations into prioritized, explainable recommendations.
3. **Act** — deterministic, typed, reversible execution through Shopify APIs, gated by the trust ladder (`00` P2).
4. **Remember** — persistent per-shop memory (`31`) so the system compounds context and never re-asks.
5. **Prove** — outcome attribution (`29`, `30`) that ties every action to a metric change. This is the retention and moat engine (`00` P10).

## North Star Metric
**Merchant-Attributed Value Delivered (MAVD)** — the dollar value of outcomes we can credibly attribute to actions the merchant approved (incremental revenue from CRO wins, recovered inventory, saved hours priced at a labor rate, deliverability-driven email revenue). MAVD aligns product, growth, and pricing: we win when the merchant provably wins.

Supporting metrics:
- **Activation:** % of installs that approve ≥1 agent action within 7 days.
- **Autonomy adoption:** % of shops with ≥1 agent at "Approve-to-execute" or higher.
- **Weekly Active Store (WAS):** shops where an agent produced value in the last 7 days.
- **Net revenue retention (NRR):** target >120% via seat/usage/plan expansion.

## Product principles
- **Zero-config value.** The first insight appears before the merchant configures anything.
- **Explain, then act.** Every recommendation states *what, why, expected impact, and how to undo.*
- **One surface.** The merchant lives in one embedded app; agents are facets, not separate tools.
- **Compounding memory.** The product should feel smarter every week per shop.
- **Trust is earned in public.** Show the audit log, show the rollbacks, show the math.

## What success looks like (3-year)
- 25,000+ paying shops, >$25M ARR, NRR >120%.
- ≥3 agents at "Auto-execute (reversible)" for the median shop.
- A defensible outcome dataset that no point-app competitor can replicate.
- Shopify Plus and enterprise brands adopting via seats and admin extensions.

## Edge cases & risks to the vision
- **Over-automation backlash:** mitigated by trust ladder, reversibility, and transparent audit (`00` P2/P3).
- **Platform dependency:** Shopify API/policy changes; mitigated by strict Shopify-native design and fast API-version rollovers (`22`).
- **Model cost/latency:** mitigated by tiered models, caching, and budgets (`16`, `31`).
- **Commoditization by Shopify Magic/Sidekick:** we differentiate on *cross-domain orchestration, memory, outcome proof, and reversible autonomy* rather than single-shot generation (`03`).

## Future expansion
Multi-channel (TikTok Shop, Amazon), B2B/wholesale, international/multi-currency ops, an agent marketplace/SDK (third parties ship agents on our runtime), and eventually a horizontal commerce-agent platform beyond Shopify. See `50_FUTURE_ROADMAP.md`.

## Maintenance
Reviewed quarterly by CEO/CTO/PM. Vision changes require an ADR in `00`. The wedge may sharpen; the OS endgame does not change without a board-level decision.
