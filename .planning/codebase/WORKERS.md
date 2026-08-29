# Worker Subprojects

This planning note mirrors the current deployable worker set in the repo. Keep it aligned with `AGENTS.md` and `WORKER_ARCHITECTURE.md`.

## Current worker set

| Worker | Entry point | Config | Purpose | Deploy script |
|--------|-------------|--------|---------|---------------|
| Main site | `src/index.ts` | `wrangler.toml` | Public site, admin UI, OAuth, search, blog, sitemap, cron | `npm run deploy` |
| Analyzer | `workers/analyzer-worker/src/index.ts` | `workers/analyzer-worker/wrangler.toml` | AI enrichment and completeness scoring | `npm run deploy:analyzer` |
| Facebook | `workers/facebook-worker/src/index.ts` | `workers/facebook-worker/wrangler.toml` | Facebook posting, token refresh, analytics, browser automation | `npm run deploy:facebook` |
| Business agent | `workers/business-agent/src/server.ts` | `workers/business-agent/wrangler.jsonc` | Owner portal, AI chat, preview/publish, voice, Atlas live view | `npm run deploy:business` |
| Discovery | `workers/discovery-worker/src/index.ts` | `workers/discovery-worker/wrangler.toml` | Discovery workflow and verification queue | `npm run deploy:discovery` |
| Verifier | `workers/verifier-agent/src/index.ts` | `workers/verifier-agent/wrangler.toml` | Independent verification of candidate businesses | `npm run deploy:verifier` |

## Shared bindings

- D1: `kiamichi-biz-connect-db`
- KV: `CACHE`
- R2: `IMAGES`, `BUSINESS_IMAGES`, `BUSINESS_ASSETS`, `TEMPLATES`
- Root worker service binding: `ANALYZER`
- Business agent service bindings: `ANALYZER`, `RAG_AGENT`, `FACEBOOK_WORKER`
- Discovery worker service / workflow plumbing: `VERIFIER`, `DISCOVERY_QUEUE`, `DISCOVERY_WORKFLOW`, `VERIFICATION_WORKFLOW`
- Facebook worker browser plumbing: `BROWSER`, `BROWSER_SESSION`

## Helper modules

`src/workers/` contains helper modules used by the root worker only:

- `src/workers/blogWorker.ts`
- `src/workers/facebookWorker.ts`

## Maintenance rule

If a worker, route, cron, queue, workflow, or binding changes, update this note in the same diff as:

- `AGENTS.md`
- `WORKER_ARCHITECTURE.md`
- `README.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`
