# AGENTS.md — KiamichiBizConnect

AI coding agents working in this repository should follow these rules.

## Project snapshot

- Local business directory platform for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas.
- Cloudflare Workers monorepo: one root worker plus deployable satellite workers under `workers/`.
- Root worker serves the public site, admin UI, OAuth, search, blog, sitemap, and the daily cron.
- Satellite workers handle enrichment, Facebook automation, owner portal/chat, business discovery, and independent verification.

## Current worker inventory

| Worker | Entry point | Config | Purpose | Deploy script |
|--------|-------------|--------|---------|---------------|
| Main site | `src/index.ts` | `wrangler.toml` | Public site, admin UI, OAuth, search, blog, cron | `npm run deploy` |
| Analyzer | `workers/analyzer-worker/src/index.ts` | `workers/analyzer-worker/wrangler.toml` | AI business enrichment and completeness scoring | `npm run deploy:analyzer` |
| Facebook | `workers/facebook-worker/src/index.ts` | `workers/facebook-worker/wrangler.toml` | Facebook posting, token refresh, analytics, browser automation | `npm run deploy:facebook` |
| Business agent | `workers/business-agent/src/server.ts` | `workers/business-agent/wrangler.jsonc` | Owner portal, AI chat, preview/publish, voice, Atlas live view | `npm run deploy:business` |
| Discovery | `workers/discovery-worker/src/index.ts` | `workers/discovery-worker/wrangler.toml` | Daily business discovery workflow and verification queue | `npm run deploy:discovery` |
| Verifier | `workers/verifier-agent/src/index.ts` | `workers/verifier-agent/wrangler.toml` | Independent candidate verification | `npm run deploy:verifier` |

## Canonical docs

Keep these docs aligned when workers, routes, bindings, or cron jobs change:

- `AGENTS.md`
- `WORKER_ARCHITECTURE.md`
- `README.md`
- `.planning/codebase/WORKERS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`

## Tech stack

- Runtime: Cloudflare Workers
- Database: D1 (SQLite)
- Storage: R2
- Cache: Workers KV
- AI: Workers AI
- Frontend: TailwindCSS + vanilla JS in the root worker; React + Vite in `workers/business-agent`
- Language: TypeScript

## Project structure

```text
├── src/                     # Main worker source
├── workers/                 # Deployable satellite workers
├── migrations/              # D1 schema migrations
├── schema.sql               # Main database schema
├── seed.sql                 # Seed data
├── wrangler.toml            # Root Cloudflare config
├── docs/                    # Architecture and operator docs
├── plans/                   # Planning notes and roadmaps
└── .github/workflows/       # CI/CD
```

## Commands

```bash
# Root worker local dev
npm run dev

# Root worker deploy
npm run deploy

# Deploy everything currently scripted from the repo root
npm run deploy:all

# Deploy individual workers
npm run deploy:analyzer
npm run deploy:facebook
npm run deploy:business
npm run deploy:discovery
npm run deploy:verifier

# Root worker uses the business-agent build for its build script
npm run build
```

Worker-local commands:

```bash
cd workers/analyzer-worker && npm run dev && npm run deploy && npm run typecheck
cd workers/facebook-worker && npm run dev && npm run deploy
cd workers/business-agent && npm run dev && npm run build && npm run deploy && npm run check
cd workers/discovery-worker && npm run dev && npm run deploy && npm run typecheck
cd workers/verifier-agent && npm run dev && npm run deploy && npm run typecheck
```

## Data and bindings

### Shared data surfaces

- D1 database: `kiamichi-biz-connect-db`
- KV namespace: `CACHE`
- R2 buckets:
  - `IMAGES` → `kiamichi-biz-images`
  - `BUSINESS_IMAGES` → `kiamichi-business-images`
  - `BUSINESS_ASSETS` → `kiamichi-business-assets`
  - `TEMPLATES` → `kiamichi-component-templates`
- All deployable workers bind the shared Flagship app id as `FLAGS`; the root worker also binds `AI` and the `ANALYZER` service binding.

### Satellite-worker notes

- `workers/business-agent/wrangler.jsonc` also binds `RAG_AGENT` and `FACEBOOK_WORKER`, plus Durable Objects `Chat`, `VoiceAgent`, and `AtlasLive`.
- `workers/facebook-worker/wrangler.toml` also binds `BROWSER` and `BROWSER_SESSION`.
- `workers/analyzer-worker/wrangler.toml`, `workers/facebook-worker/wrangler.toml`, `workers/business-agent/wrangler.jsonc`, `workers/discovery-worker/wrangler.toml`, and `workers/verifier-agent/wrangler.toml` all bind the shared Flagship app as `FLAGS`.
- `workers/discovery-worker/wrangler.toml` also binds queue/workflow plumbing and the `VERIFIER` service binding.
- `workers/verifier-agent/wrangler.toml` is AI-driven and expects `VERIFIER_SHARED_SECRET`.

## Do

- Use D1 prepared statements; never interpolate raw SQL.
- Keep worker responsibilities narrow and explicit.
- Update the worker inventory and architecture docs in the same diff as any worker change.
- Keep route, queue, workflow, cron, and binding names in docs synchronized with `wrangler` config.
- Store images in the correct R2 bucket.
- Use `CACHE` for short-lived shared data where the repo already does.
- Use existing route patterns and helper modules before adding new ones.
- Return proper HTTP status codes.

## Don't

- Don't hardcode database IDs or secrets.
- Don't bypass D1 for persistent data.
- Don't store PII in logs.
- Don't add heavy frontend frameworks to the root worker.
- Don't commit `.dev.vars` or real tokens.
- Don't use `any` types when a concrete interface will do.

## Safety & permissions

**Allowed without asking:**
- Read/list files
- Type checks
- Local dev servers
- D1 SELECT queries

**Ask first:**
- `npm install` for new dependencies
- `wrangler deploy` to production
- D1 schema changes / migrations
- R2 bucket operations
- `git push`
- Modifying business submission flow

## Documentation pointers

- `README.md` — entry-point overview
- `WORKER_ARCHITECTURE.md` — current worker and binding map
- `docs/11-bigfoot-kbc-agent.md` — Bigfoot cron prompts and delivery rules
- `.planning/codebase/WORKERS.md` — planning-time worker inventory
- `.planning/codebase/ARCHITECTURE.md` — current architecture map
- `.planning/codebase/STRUCTURE.md` — repo layout map

## PR checklist

- [ ] TypeScript compiles for the touched worker(s)
- [ ] No hardcoded secrets
- [ ] D1 migrations are versioned when schema changes
- [ ] Tested locally with the relevant `npm run dev`
- [ ] Small, focused diff
- [ ] Docs updated when worker/binding/cron behavior changes
