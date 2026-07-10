# 35 — SEO

## Purpose
Cover SEO in three senses: (1) **App Store SEO** (ranking in Shopify's App Store), (2) **marketing-site SEO** (TryMerchantAI.com), and (3) the **merchant storefront SEO** our SEO Agent improves. Distinguishing these prevents confusion.

## Goals
- Rank the app for high-intent App Store searches (primary acquisition, `02`).
- Rank the marketing site for category + comparison terms.
- Deliver measurable storefront SEO wins for merchants (product value + MAVD `29`).

## 1) Shopify App Store SEO (`43`)
Ranking factors we can influence:
- **Listing relevance:** app name, tagline, description with natural high-intent keywords ("AI store optimization," "SEO," "CRO," "AI assistant," "store health"). No keyword stuffing (rejection risk).
- **Category + tags:** correct primary category + relevant tags.
- **Conversion signals:** install rate, listing→install CVR (great screenshots, demo video, clear value), retention.
- **Reviews:** volume + rating + recency (drive via in-app prompts at "aha" moments, never incentivized against policy).
- **Performance + quality:** low uninstall rate, App Store quality signals, no policy violations.
- **Keywords research:** mine competitor listings + reviews (`03`,`04`) for terms merchants actually search.
- **Localization:** localized listings expand reach (`50`).
Assets: high-quality screenshots (annotated, real UI), demo video, benchmark stats, social proof. Iterate via listing A/B where possible.

## 2) Marketing site SEO (TryMerchantAI.com)
- **Technical SEO:** fast (CWV green), mobile-first, clean IA, HTTPS, sitemap.xml, robots.txt, structured data (Organization, SoftwareApplication, FAQ, Breadcrumb), canonical tags, no render-blocking, image optimization.
- **Content strategy (`02` Motion 2):** category pages, comparison pages ("TryMerchantAI vs X"), use-case pages, and a resource hub (AI ecommerce ops playbooks, benchmark reports from anonymized data). Target informational→commercial intent funnel.
- **On-page:** unique titles/meta, semantic headings, internal linking, keyword-mapped pages, schema, alt text.
- **Authority:** backlinks via content, partnerships, App Store, PR, integrations directories.
- **Measurement:** rankings, organic traffic, signups from organic, assisted conversions (`29`).

## 3) Merchant storefront SEO (our SEO Agent product) (`16`)
What the SEO Agent optimizes on merchants' stores:
- **On-page:** product/collection **title tags + meta descriptions** (length, keywords, uniqueness), **image alt text**, heading structure, thin/duplicate content detection + enrichment (Content Agent).
- **Structured data:** Product/Offer/Review/Breadcrumb JSON-LD (many themes lack complete markup) for rich results.
- **Technical:** URL/handle hygiene, canonicalization, sitemap/robots signals (within Shopify's control), broken links, redirects on handle changes (avoid 404s), duplicate-content from variants/params.
- **Performance:** storefront speed signals (theme/image weight) affecting rankings (`23`,`33`).
- **Internationalization (future):** hreflang for Markets.
- **Guardrails:** all changes reversible/previewed (`00` P3); no black-hat tactics (keyword stuffing, cloaking) — would harm merchant + violate search guidelines. Only white-hat, honest optimization.
- **Outcome:** track ranking/impression/click proxies + attribute to MAVD (`29`,`30`) — with honest confidence (SEO is noisy).

## Cross-cutting
- Keyword research shared across all three (what merchants search maps to both our acquisition + the value we sell).
- The storefront SEO wins become marketing proof (case studies, benchmarks) — a flywheel (`02`).

## Security/quality
- No manipulative SEO on merchant stores (protect their domain reputation).
- Structured data must be accurate (false markup → Google penalties → merchant harm).
- Redirect management to avoid link-equity loss + 404s.

## Edge cases
- Handle/URL change → auto-create redirect; never orphan a ranking URL.
- Variant/param duplicate content → canonical handling.
- Merchant on a theme without schema support → inject via app (Theme App Extension) safely.
- Aggressive keyword requests → refuse stuffing; explain white-hat approach.
- International store → language/hreflang correctness (future).
- Measurement noise → confidence-labeled MAVD, longer windows for SEO.

## Testing (`36`)
- App/marketing: Lighthouse SEO, structured-data validation, broken-link checks, sitemap/robots tests.
- Product (SEO Agent): action correctness (title/meta/alt updates + undo), redirect creation on handle change, JSON-LD validity tests, no-regression on storefront performance.

## Future expansion
AI-driven content clusters, programmatic SEO for the marketing site, hreflang/international storefront SEO, and generative-engine optimization (GEO — being cited by AI answer engines) for both us and merchants (`50`).

## Decisions (ADR)
- **ADR-035-1:** Only white-hat storefront SEO; refuse manipulative tactics to protect merchant domains.
- **ADR-035-2:** Handle changes always create redirects; structured data must be accurate.

## Maintenance
Owned by Growth + AI Eng (product side). App/marketing SEO reviewed quarterly; storefront SEO agent rules updated with search-engine guideline changes. Keyword research refreshed continuously (`04`).
