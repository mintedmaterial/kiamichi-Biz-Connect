# Architecture

## Current architecture

KiamichiBizConnect is a Cloudflare Workers application with one root worker and five deployable satellite workers.

- The root worker at `src/index.ts` owns the public directory site, admin UI, OAuth, search, blog, sitemap, and the scheduled cron.
- Satellite workers under `workers/` split out enrichment, Facebook automation, owner portal/chat, discovery, and verification.
- Shared state lives in Cloudflare services: one D1 database, one KV namespace, and several R2 buckets.
- `src/workers/*` are helper modules for the root worker, not separate deployments.

## Worker summary

| Worker | Entry point | Main responsibility |
|--------|-------------|---------------------|
| Main site | `src/index.ts` | Public site, admin UI, OAuth, search, blog, sitemap, cron |
| Analyzer | `workers/analyzer-worker/src/index.ts` | AI enrichment and completeness scoring |
| Facebook | `workers/facebook-worker/src/index.ts` | Facebook posting and browser automation |
| Business agent | `workers/business-agent/src/server.ts` | Owner portal, AI chat, preview/publish, voice, Atlas live view |
| Discovery | `workers/discovery-worker/src/index.ts` | Discovery workflow and verification queue |
| Verifier | `workers/verifier-agent/src/index.ts` | Independent candidate verification |

## Shared bindings

### Storage

- D1: `kiamichi-biz-connect-db`
- KV: `CACHE`
- R2: `IMAGES`, `BUSINESS_IMAGES`, `BUSINESS_ASSETS`, `TEMPLATES`

### Services and workflows

- Shared feature-flag app → `FLAGS` on the root worker and every deployable satellite worker
- Root worker → `ANALYZER`
- Business agent → `ANALYZER`, `RAG_AGENT`, `FACEBOOK_WORKER`
- Discovery worker → `VERIFIER`, `DISCOVERY_QUEUE`, `DISCOVERY_WORKFLOW`, `VERIFICATION_WORKFLOW`, `FLAGS`
- Facebook worker → `BROWSER`, `BROWSER_SESSION`, `FLAGS`

## Data flow snapshot

1. Public requests hit the root worker.
2. The root worker reads D1/R2/KV and can call the analyzer by service binding.
3. The business agent handles owner edits and publishes static pages to R2.
4. The discovery worker creates candidate records and hands them to the verifier workflow.
5. The verifier worker independently scores each candidate and returns approve/review/reject.
6. The Facebook worker handles scheduled social automation and browser-backed fallbacks.

## Maintenance note

Keep this file aligned with:

- `AGENTS.md`
- `WORKER_ARCHITECTURE.md`
- `README.md`
- `.planning/codebase/WORKERS.md`
- `.planning/codebase/STRUCTURE.md`
