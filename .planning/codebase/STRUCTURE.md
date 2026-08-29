# Codebase Structure

## Directory layout

```text
kiamichi-biz-connect/
├── src/                     # Root worker source
│   ├── index.ts             # Main entry point
│   ├── database.ts          # D1 helpers
│   ├── admin.ts             # Admin UI handlers
│   ├── templates.ts         # Shared HTML shell
│   ├── auth/                # OAuth and session helpers
│   ├── workers/             # Helper modules used only by the root worker
│   └── ...                  # Other root-worker modules
├── workers/                 # Deployable satellite workers
│   ├── analyzer-worker/
│   ├── facebook-worker/
│   ├── business-agent/
│   ├── discovery-worker/
│   └── verifier-agent/
├── migrations/              # D1 schema migrations
├── backend/migrations/      # Data/import SQL migrations
├── docs/                    # Operational and agent docs
├── plans/                   # Roadmaps and planning notes
├── schema.sql               # Core schema
├── seed.sql                 # Seed data
├── wrangler.toml            # Root worker config
├── package.json             # Root scripts
└── tsconfig.json            # TypeScript config
```

## Directory purpose

### `src/`

Root worker implementation:

- HTTP routes and scheduled cron handling
- D1 access and business data helpers
- admin UI, OAuth, and shared templates
- root-worker-only helper modules in `src/workers/`

### `workers/`

Standalone deployable Worker projects:

- `analyzer-worker` — AI enrichment
- `facebook-worker` — Facebook automation and browser fallback
- `business-agent` — owner portal and publish flow
- `discovery-worker` — discovery and verification workflow orchestration
- `verifier-agent` — independent verification service

Each deployable worker binds the shared Flagship app as `FLAGS` so feature gating is consistent across the monorepo.

### `docs/`

Human-facing operating docs and guides, including the Bigfoot agent guide and feature notes.

### `plans/`

Planning docs and project maps. These should reflect the same worker inventory as the main docs.

### `migrations/`

Versioned D1 schema changes. Keep new schema changes in numbered migration files.

### `backend/migrations/`

Import/data SQL migrations used for bulk or historical data work.

## Key files

- `src/index.ts` — root worker entry
- `workers/analyzer-worker/src/index.ts` — analyzer entry
- `workers/facebook-worker/src/index.ts` — Facebook entry
- `workers/business-agent/src/server.ts` — business agent entry
- `workers/discovery-worker/src/index.ts` — discovery entry
- `workers/verifier-agent/src/index.ts` — verifier entry
- `wrangler.toml` — root worker bindings, routes, and cron
- `workers/business-agent/wrangler.jsonc` — business-agent bindings and Durable Objects
- `workers/analyzer-worker/wrangler.toml` — analyzer config
- `workers/facebook-worker/wrangler.toml` — Facebook config
- `workers/discovery-worker/wrangler.toml` — discovery config with queue/workflow + feature-flag gating
- `workers/verifier-agent/wrangler.toml` — verifier config

## Where to add new code

### New root-worker route or page

- Add the handler in `src/index.ts` or a helper under `src/`
- Use `src/database.ts` for D1 access
- Update `wrangler.toml` if the route, cron, or binding changes

### New satellite worker

- Create `workers/<name>/`
- Add `src/index.ts` or `src/server.ts`
- Add the worker config (`wrangler.toml` or `wrangler.jsonc`)
- Add a deploy script to the root `package.json`
- Update `AGENTS.md`, `WORKER_ARCHITECTURE.md`, and this file

### New docs

- Keep overview docs short and canonical
- Prefer one current map over many duplicated summaries

## Maintenance note

This file should change whenever the repo’s deployed worker set or top-level directory layout changes.
