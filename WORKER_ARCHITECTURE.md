# Worker Architecture

## Overview

KiamichiBizConnect is a Cloudflare Workers monorepo with one root worker and five deployable satellite workers.

- The root worker lives at `src/index.ts` and serves the public site, admin UI, OAuth, search, blog, sitemap, and the daily cron.
- Files under `src/workers/` are helper modules imported by the root worker. They are **not** separate Cloudflare Workers.
- Deployable worker projects live under `workers/` and each has its own config and deploy script.

## Current worker map

| Worker | Entry point | Config | Purpose | Triggers / notable bindings | Deploy |
|--------|-------------|--------|---------|-----------------------------|--------|
| Main site | `src/index.ts` | `wrangler.toml` | Public site, admin UI, OAuth, search, blog, sitemap, daily automation | Route: `kiamichibizconnect.com/*` and `www.kiamichibizconnect.com/*`; cron at `15 14 * * *`; bindings: `DB`, `CACHE`, `IMAGES`, `BUSINESS_IMAGES`, `BUSINESS_ASSETS`, `TEMPLATES`, `AI`, `FLAGS`, `ANALYZER` | `npm run deploy` |
| Analyzer | `workers/analyzer-worker/src/index.ts` | `workers/analyzer-worker/wrangler.toml` | AI enrichment and completeness scoring for business listings | Cron at `0 14 * * *`, `0 20 * * *`, `0 2 * * *`; bindings: `DB`, `AI`, `IMAGES`, `CACHE`, `FLAGS`; env: `MAIN_WORKER_URL`, `ANALYZER_VERSION`, `MAX_AUTO_UPDATES_PER_DAY`, `AUTO_APPLY_CONFIDENCE_THRESHOLD`, `USE_CODE_MODE` | `npm run deploy:analyzer` |
| Facebook | `workers/facebook-worker/src/index.ts` | `workers/facebook-worker/wrangler.toml` | Facebook posting, token refresh, analytics, browser automation | Cron at `0 0 * * *`, `0 2,14 * * *`, `0 3,15,22 * * *`; bindings: `DB`, `CACHE`, `IMAGES`, `AI`, `FLAGS`, `BROWSER`, `BROWSER_SESSION` | `npm run deploy:facebook` |
| Business agent | `workers/business-agent/src/server.ts` | `workers/business-agent/wrangler.jsonc` | Owner portal, AI chat, preview/publish, voice, Atlas live view | Route: `app.kiamichibizconnect.com/*`; bindings: `DB`, `CACHE`, `AI`, `FLAGS`, `TEMPLATES`, `BUSINESS_ASSETS`, `IMAGES`, `BUSINESS_IMAGES`, `ANALYZER`, `RAG_AGENT`, `FACEBOOK_WORKER`; Durable Objects: `Chat`, `VoiceAgent`, `AtlasLive` | `npm run deploy:business` |
| Discovery | `workers/discovery-worker/src/index.ts` | `workers/discovery-worker/wrangler.toml` | Daily business discovery workflow and verification queue | Cron at `0 14 * * *`; bindings: `DB`, `CACHE`, `AI`, `FLAGS`, `DISCOVERY_QUEUE`, `DISCOVERY_WORKFLOW`, `VERIFICATION_WORKFLOW`, `VERIFIER` | `npm run deploy:discovery` |
| Verifier | `workers/verifier-agent/src/index.ts` | `workers/verifier-agent/wrangler.toml` | Independent verification of candidate businesses and enrichments | Bindings: `AI`, `FLAGS`; expects `VERIFIER_SHARED_SECRET`; HTTP `/health` and `/verify` | `npm run deploy:verifier` |

## Worker responsibilities

### Main worker

The root worker owns the public surface area:

- homepage and category/business pages
- admin UI and OAuth callbacks
- search and sitemap routes
- daily blog automation
- shared storage access through D1, KV, R2, Workers AI, and feature flags

### Analyzer worker

The analyzer worker handles AI-assisted enrichment of business listings.

- manual analyze requests via `/analyze`
- cron-driven enrichment passes
- auto-apply of high-confidence updates
- shared D1/R2/KV access with the root worker

### Facebook worker

The Facebook worker owns Facebook automation.

- scheduled page/group posting
- token refresh and analytics collection
- featured business rotation
- browser-based fallback flows through the browser binding and Durable Object session

### Business agent

The business agent is the owner portal.

- chat-driven content editing and publishing
- preview rendering and static page publishing to R2
- voice/Atlas live view features
- service-bound calls to analyzer, RAG, and Facebook worker services

### Discovery worker

The discovery worker handles the discovery pipeline.

- scheduled discovery runs
- queue-backed handoff into verification workflows
- separate verification workflow orchestration
- service binding to the verifier worker

### Verifier agent

The verifier agent performs the last-check evaluation.

- independent validation of candidate businesses
- AI-based verdicts with approve/review/reject outcomes
- shared-secret protection on `/verify`

## Shared storage and bindings

### Shared across the repo

- D1: `kiamichi-biz-connect-db`
- KV: `CACHE`
- R2 buckets:
  - `IMAGES` → `kiamichi-biz-images`
  - `BUSINESS_IMAGES` → `kiamichi-business-images`
  - `BUSINESS_ASSETS` → `kiamichi-business-assets`
  - `TEMPLATES` → `kiamichi-component-templates`

### Main-worker service binding

- `ANALYZER` → `kiamichi-biz-ai-analyzer`

### Business-agent service bindings

- `ANALYZER` → `kiamichi-biz-ai-analyzer`
- `RAG_AGENT` → `purple-snow-f107-nlweb`
- `FACEBOOK_WORKER` → `kiamichi-facebook-worker`

### Discovery-worker service / workflow plumbing

- `VERIFIER` → `kiamichi-biz-verifier`
- `DISCOVERY_QUEUE` → `kiamichi-business-discovery`
- `DISCOVERY_WORKFLOW` → `kiamichi-daily-business-discovery`
- `VERIFICATION_WORKFLOW` → `kiamichi-business-verification`

### Facebook-worker browser plumbing

- `BROWSER`
- `BROWSER_SESSION`

## Helper modules in `src/workers/`

These are importable modules, not separate deployments:

- `src/workers/blogWorker.ts` — daily blog automation helper for the root worker
- `src/workers/facebookWorker.ts` — shared Facebook helper logic for the root worker

## Maintenance rule

When a worker, route, queue, workflow, cron expression, or binding changes, update this file together with:

- `AGENTS.md`
- `README.md`
- `.planning/codebase/WORKERS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`

That keeps the repo instructions and the planning docs aligned with the deployed worker set.
