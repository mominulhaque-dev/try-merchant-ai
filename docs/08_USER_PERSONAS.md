# 08 — User Personas

## Purpose
Give the team shared, memorable models of who we build for, their jobs-to-be-done, pains, and success criteria — so every design and prioritization call can ask "does this help [persona] do [job]?"

## Goals
- 3 primary + 2 secondary personas with JTBD, pains, gains, and objections.
- Explicit mapping of personas → features (`07`) and autonomy comfort (`00` P2).

## Primary personas

### P1 — "Maya, the Overwhelmed Operator" (core ICP)
- **Context:** Solo founder of a $30k/mo apparel store on Shopify Growth. 60-hour weeks, no specialists, runs ~9 apps.
- **JTBD:** "Tell me what to fix first and just handle the busywork — but don't break my store."
- **Pains:** No time, no SEO/CRO expertise, tool overload, fear of AI touching live store, decision paralysis.
- **Gains:** A prioritized to-do list with impact estimates; one-click reversible fixes; proof it worked; hours back.
- **Autonomy comfort:** starts at Suggest/Approve; graduates to reversible auto for low-risk tasks after trust builds.
- **Objections:** "Will it mess up my store?" (→ reversibility + audit), "Is it worth $49?" (→ MAVD, replaces apps + hours).
- **Success:** approves first action in day 1; sees a measurable win in week 1.
- **Key features:** F-01, F-02, F-03, F-08, F-06/07.

### P2 — "Devon, the Growth-Stage Marketer" (secondary core)
- **Context:** Marketing lead at a $600k/mo beauty brand (10 people), some specialists, on Advanced/Plus.
- **JTBD:** "Give me leverage across SEO, email, and CRO, and show me ROI I can report up."
- **Pains:** Stretched team, fragmented data across tools, hard to prove channel ROI, slow experimentation.
- **Gains:** Cross-domain orchestration, experiment ideas + execution, ROI dashboards, seats for the team.
- **Autonomy comfort:** comfortable up to reversible auto with guardrails; wants governance + audit.
- **Objections:** "Does it integrate with Klaviyo?" (→ orchestrate, don't rip-replace), "Can I control what it does?" (→ policies/roles).
- **Success:** measurable lift in a target metric within a quarter; adopts ≥3 agents.
- **Key features:** F-03, F-04, F-05, F-07, F-09.

### P3 — "Riya, the Agency Operator" (secondary, high-LTV)
- **Context:** Runs a Shopify agency managing 40 client stores.
- **JTBD:** "Multiply my team across many stores without hiring — with control per client."
- **Pains:** Doesn't scale, repetitive audits, context-switching, junior staff inconsistency.
- **Gains:** Multi-store dashboard, standardized playbooks, per-client autonomy + reporting, white-label (future).
- **Autonomy comfort:** high, but per-client governed; needs audit for client trust.
- **Objections:** billing across clients, data isolation, white-label timing.
- **Success:** onboards multiple client stores; reduces per-store labor materially.
- **Key features:** multi-store (future `50`), F-04, F-07, F-09, seats/roles (`26`).

## Tertiary / edge personas

### P4 — "Sam, the New Store Builder"
- Just launched, <$5k/mo, few products. JTBD: "Am I even set up right?" Needs setup completeness + education. Mostly free tier; low WTP. Value: health checklist, guided fixes. Not a paid-conversion target yet but a brand/word-of-mouth seed.

### P5 — "Alex, the Skeptical Enterprise Ops Lead"
- At a large brand on Plus. JTBD: "Prove it's safe, governed, and worth enterprise spend." Cares about SSO, audit, data residency, SLAs, autonomy policy. Gatekept by security review. Value: governance + `32`/`43` posture. Converts slowly, high ACV.

## Anti-persona (who we don't build for)
- Merchants seeking a generic chatbot with no execution.
- Non-Shopify merchants (until platform expansion).
- Sub-$5k stores expecting heavy paid features free forever.
- Anyone wanting the AI to act with zero oversight (conflicts with `00` P2).

## JTBD → feature map
| JTBD | Persona | Features |
|---|---|---|
| "What's wrong, what first?" | Maya, Sam | F-01, F-08 |
| "Do the busywork, reversibly" | Maya, Devon | F-02, F-04 |
| "Ask + act in one place" | all | F-03 |
| "Leverage across domains" | Devon, Riya | F-03, F-04, agents |
| "Prove ROI / report up" | Devon, Riya, Alex | F-07, F-05 |
| "Govern + control" | Devon, Riya, Alex | F-09, `26` |

## Trust & autonomy by persona
Maps to `00` P2 defaults: Maya/Sam default conservative (Suggest); Devon/Riya can opt into reversible auto with guardrails; Alex requires explicit policy + audit before any autonomy. Onboarding (`09`) sets defaults by detected profile.

## Edge cases
- Persona mismatch (agency signs up on Growth plan) → detect multi-store intent, suggest right plan.
- Persona evolves (Maya scales to Devon) → product must grow with them (plan + autonomy expansion = NRR).

## Research provenance
Personas are hypotheses until validated by the `04` research plan; update from interviews + in-product behavior. Do not treat as fixed.

## Future expansion
Add localized/international personas and B2B/wholesale buyer-side personas as those markets open (`50`).

## Maintenance
Owned by PM. Revisit each quarter against real usage cohorts; keep persona IDs stable for referencing in specs and design.
