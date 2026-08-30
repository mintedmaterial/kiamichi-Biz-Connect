# KiamichiBizConnect

Cloudflare Workers monorepo for the Kiamichi business directory: public site, admin tooling, business-owner portal, enrichment automation, Facebook automation, discovery, and verification.

## What lives here

| Worker | Purpose |
|--------|---------|
| Main site | Public directory site, admin UI, OAuth, search, blog, sitemap, cron |
| Analyzer | AI enrichment and completeness scoring |
| Facebook | Facebook posting, token refresh, analytics, browser automation |
| Business agent | Owner portal, AI chat, preview/publish, voice, Atlas live view |
| Discovery | Daily discovery workflow and verification queue |
| Verifier | Independent verification of candidate businesses |

## Tech stack

- Cloudflare Workers
- D1 (SQLite)
- R2
- Workers KV
- Workers AI
- TailwindCSS + vanilla JS in the root worker
- React + Vite in `workers/business-agent`
- TypeScript

## Entry points

- `src/index.ts` — root worker
- `workers/analyzer-worker/src/index.ts`
- `workers/facebook-worker/src/index.ts`
- `workers/business-agent/src/server.ts`
- `workers/discovery-worker/src/index.ts`
- `workers/verifier-agent/src/index.ts`

## Quick start

```bash
npm install
npm run dev
```

Root worker deploy:

```bash
npm run deploy
```

Deploy all scripted workers:

```bash
npm run deploy:all
```

Individual deploys:

```bash
npm run deploy:analyzer
npm run deploy:facebook
npm run deploy:business
npm run deploy:discovery
npm run deploy:verifier
```

## Project structure

```text
kiamichi-biz-connect/
├── src/                     # Main worker source
├── workers/                 # Deployable satellite workers
├── migrations/              # D1 migrations
├── docs/                    # Worker and operator docs
├── plans/                   # Planning notes
├── schema.sql               # Core schema
├── seed.sql                 # Seed data
├── wrangler.toml            # Root Worker config
└── package.json             # Root scripts
```

## Canonical docs

- `AGENTS.md`
- `WORKER_ARCHITECTURE.md`
- `.planning/codebase/WORKERS.md`
- `.planning/codebase/ARCHITECTURE.md`
- `.planning/codebase/STRUCTURE.md`

## Notes for contributors

- `src/workers/*` are helper modules for the root worker, not separate deployments.
- Discovery worker uses a Flagship feature flag to gate the daily discovery pipeline until automation is tuned.
- Every deployable worker binds the same shared Flagship app id as `FLAGS` so feature gates can be evaluated consistently across the app.
- Each folder under `workers/` is its own deployable Worker project.
- Update the architecture/docs inventory whenever a worker, route, cron, queue, or binding changes.

## Development reminders

- Use prepared statements for D1 queries.
- Keep secrets out of git; use Wrangler secrets for sensitive values.
- Keep changes small and documented.

## Support

For the current worker map and binding details, read `WORKER_ARCHITECTURE.md` first.
