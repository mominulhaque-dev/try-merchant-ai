# CLAUDE.md

# TryMerchantAI

## Project Overview

Project Name: TryMerchantAI

Mission:

Build the world's most intelligent AI Commerce Operating System for Shopify.

This is NOT a simple Shopify app.

This is a long-term enterprise SaaS platform designed to become an AI employee for Shopify merchants.

The product must be scalable enough to support millions of merchants.

---

# Current Status

The Shopify application already exists.

Already completed:

- Shopify App Init
- Shopify CLI Setup
- OAuth
- Embedded App
- Local Development
- Git Repository
- Existing Architecture

NEVER:

- Create another Shopify app
- Run Shopify App Init again
- Replace the existing project
- Delete working code
- Rewrite working architecture without reason

Always extend the existing application.

---

# Source of Truth

The following directories are the only source of truth:

/docs

/project_state

Always follow them.

If documentation conflicts,

choose the better enterprise solution.

---

# Implementation Mode

Documentation phase is COMPLETE.

Do NOT generate new documentation.

Do NOT generate new markdown files unless explicitly requested.

Focus only on implementation.

---

# Development Workflow

Before implementing any feature:

1. Inspect CURRENT_STATE.md
2. Inspect ACTIVE_TASK.md
3. Inspect NEXT_TASK.md
4. Read only the documentation related to the current task
5. Inspect existing implementation
6. Reuse existing architecture
7. Implement
8. Test
9. Refactor
10. Continue automatically

Never ask:

"What should I build next?"

Determine the next task yourself.

---

# Project State

Always maintain:

/project_state/CURRENT_STATE.md

/project_state/ACTIVE_TASK.md

/project_state/NEXT_TASK.md

/project_state/IMPLEMENTATION_PROGRESS.md

/project_state/KNOWN_ISSUES.md

/project_state/CHANGELOG.md

Keep them short.

Update them only when necessary.

---

# Architecture

Think like:

Shopify Staff Engineer

Principal Software Engineer

Principal AI Engineer

Enterprise SaaS Architect

Never think like a beginner.

---

# Tech Stack

Shopify Remix

TypeScript

React

Remix

Node.js

GraphQL

Polaris

App Bridge

Prisma

PostgreSQL

Redis

BullMQ

Docker

Cloudflare

GitHub

OpenAI

Anthropic

MCP

AI Agents

---

# UI

Always follow:

Shopify Polaris

Modern SaaS Design

Minimal UI

Excellent UX

Accessible UI

Responsive UI

Premium animations

Professional spacing

Consistent components

Before creating a new component,

check whether one already exists.

Reuse components whenever possible.

---

# Coding Standards

Always write:

Production-ready code

Enterprise-grade architecture

Reusable components

Modular code

Strong typing

Meaningful naming

No duplicate logic

No duplicate UI

No dead code

No TODO placeholders

No fake implementations

No mock production code

---

# Performance

Always optimize for:

Performance

Scalability

Security

Accessibility

Developer Experience

Maintainability

Low bundle size

Lazy loading

Code splitting

Caching

Database optimization

Efficient GraphQL queries

---

# Security

Always validate:

Authentication

Authorization

Permissions

Input validation

Rate limiting

CSRF

XSS

SQL Injection

Secrets

Environment variables

Never expose sensitive data.

---

# Shopify

Always follow:

Polaris

App Bridge

GraphQL

Billing API

Embedded Apps

Webhooks

Theme App Extensions

Metaobjects

Functions

Flow

Admin Extensions

App Store Guidelines

Accessibility Guidelines

Performance Guidelines

Never implement features that could cause App Store rejection.

---

# AI

Whenever AI functionality is required:

Prefer reusable AI services.

Avoid duplicated prompts.

Use structured prompts.

Optimize token usage.

Design AI agents to be modular.

Keep prompts maintainable.

---

# Token Optimization

Never reread the entire documentation.

Instead:

Read CURRENT_STATE.md

Read ACTIVE_TASK.md

Read NEXT_TASK.md

Read only task-related documentation.

Read only task-related source code.

This minimizes context usage.

---

# Git

Prefer small commits.

Keep commits focused.

Avoid large unrelated changes.

Maintain clean history.

---

# If Blocked

If blocked by missing information:

Search the repository first.

Inspect related code.

Inspect related documentation.

Only ask the user if absolutely necessary.

---

# Automatic Improvements

If a better architecture exists,

implement it.

If a better UX exists,

implement it.

If Shopify has a newer best practice,

use it.

If performance can be improved,

improve it.

If security can be improved,

improve it.

If maintainability can be improved,

improve it.

---

# Final Objective

Transform the existing Shopify application into TryMerchantAI.

Do not restart.

Do not rebuild.

Do not duplicate.

Continue implementing until the product is complete.

Every decision should move the project toward becoming the best AI Commerce Operating System for Shopify.