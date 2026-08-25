# Codebase Structure

**Analysis Date:** 2026-08-25

## Directory Layout

```
kiamichi-biz-connect/
├── src/                          # Main worker source
│   ├── index.ts                  # Main entry point (router, cron)
│   ├── database.ts               # D1 DatabaseService
│   ├── admin.ts                  # Admin dashboard handlers
│   ├── templates.ts              # HTML shell / shared CSS
│   ├── types.ts                  # Shared TypeScript interfaces
│   ├── auth/                     # OAuth and session helpers
│   ├── workers/                  # Background worker modules
│   └── facebook-*.ts             # Facebook integration modules
├── workers/                      # Satellite workers
│   ├── analyzer-worker/          # AI enrichment worker
│   ├── facebook-worker/          # Facebook automation worker
│   └── business-agent/           # Owner portal / chat agent
├── migrations/                   # D1 schema migrations (project root)
├── backend/migrations/           # Additional data/import migrations
├── docs/                         # Project documentation
├── plans/                        # Roadmaps, TODOs, strategy docs
├── scripts/                      # Local/import utility scripts
├── public/                       # Static public assets
├── templates/                    # Static HTML component templates for R2 publishing
├── branding/                     # Brand assets
├── Businessdata/                 # Business data assets
├── dist/                         # Build output (generated)
├── .github/workflows/            # CI/CD
├── .worktrees/                   # Git worktrees (active branches)
├── .wrangler/                    # Wrangler local state (generated)
├── schema.sql                    # Core D1 schema
├── seed.sql                      # Seed data
├── wrangler.toml                 # Main worker config
├── package.json                  # Root dependencies and scripts
└── tsconfig.json                 # TypeScript config
```

## Directory Purposes

**`src/`:**
- Purpose: Main Cloudflare Worker code.
- Contains: Router, page/API handlers, database service, admin logic, OAuth, templates, background workers, Facebook integrations.
- Key files: `src/index.ts`, `src/database.ts`, `src/admin.ts`, `src/templates.ts`, `src/types.ts`.

**`src/auth/`:**
- Purpose: Authentication providers and session middleware.
- Contains: Google, Facebook, GitHub OAuth handlers and cookie/session helpers.
- Key files: `src/auth/google.ts`, `src/auth/facebook-admin.ts`, `src/auth/github.ts`, `src/auth/middleware.ts`, `src/auth/types.ts`.

**`src/workers/`:**
- Purpose: Modules invoked by the main worker's cron.
- Contains: Daily blog generation (`blogWorker.ts`) and legacy Facebook worker loader.
- Key files: `src/workers/blogWorker.ts`.

**`workers/`:**
- Purpose: Independently deployable worker projects.
- Contains: analyzer-worker, facebook-worker, business-agent.
- Key files: `workers/analyzer-worker/src/index.ts`, `workers/facebook-worker/src/index.ts`, `workers/business-agent/src/server.ts`.

**`migrations/`:**
- Purpose: Core D1 schema migrations.
- Contains: `schema.sql`-level incremental migrations (naming is inconsistent).
- Key files: `migrations/006_preview_publish_system.sql`, `migrations/005_business_portal.sql`.

**`backend/migrations/`:**
- Purpose: Data-only / import migrations.
- Contains: Timestamped business import SQL files.
- Key files: `backend/migrations/1765568923132_import_businesses.sql`.

**`docs/`:**
- Purpose: Feature and operation documentation.
- Contains: Bigfoot agent guide (`11-bigfoot-kbc-agent.md`), AI blog plan, analyzer guide.
- Key files: `docs/11-bigfoot-kbc-agent.md`, `docs/AI_BLOG_GENERATION.md`.

**`plans/`:**
- Purpose: Roadmaps, weekly TODOs, strategy docs.
- Contains: Facebook automation TODO, platform vision.
- Key files: `plans/TODO.md`, `plans/FACEBOOK_AUTOMATION_ENHANCEMENT.md`.

**`templates/`:**
- Purpose: Static HTML component templates used by the business-agent publishing pipeline.
- Contains: Component category folders (`hero/`, `about/`, `gallery/`, etc.).
- Key files: `templates/hero/`, `templates/about/`.

**`public/`:**
- Purpose: Static public assets.
- Contains: `robots.txt`, random images bucket.
- Key files: `public/robots.txt`.

**`scripts/`:**
- Purpose: Local utility scripts.
- Contains: CSV import scripts, template upload script.
- Key files: `scripts/import-businesses.js`, `scripts/upload-templates.js`.

**`.github/workflows/`:**
- Purpose: CI/CD.
- Contains: `ci.yml`, `deploy.yml`, `preview.yml`, `validate.sh`.

**`.worktrees/`:**
- Purpose: Git worktrees for parallel branch work.
- Contains: `admin/displayandBusiness/display` worktree.
- Note: This directory is untracked in `main`; do not commit.

## Key File Locations

**Entry Points:**
- `src/index.ts`: Main worker fetch/cron entry.
- `workers/analyzer-worker/src/index.ts`: Analyzer worker fetch/cron entry.
- `workers/facebook-worker/src/index.ts`: Facebook worker fetch/cron entry.
- `workers/business-agent/src/server.ts`: Business agent portal entry.

**Configuration:**
- `wrangler.toml`: Main worker bindings and routes.
- `workers/business-agent/wrangler.jsonc`: Business agent bindings and Durable Objects.
- `workers/facebook-worker/wrangler.toml`: Facebook worker config.
- `workers/analyzer-worker/wrangler.toml`: Analyzer worker config.
- `package.json`: Root scripts and dependencies.
- `tsconfig.json`: TypeScript compiler options.
- `.github/workflows/ci.yml`: Type checking, build matrix, tests, security audit.
- `.github/workflows/deploy.yml`: Production deployment orchestration.

**Core Logic:**
- `src/database.ts`: D1 CRUD and search.
- `src/admin.ts`: Admin dashboard HTML/JSON endpoints.
- `src/templates.ts`: Shared HTML shell and CSS.
- `src/workers/blogWorker.ts`: Daily blog automation.

**Testing:**
- `workers/business-agent/src/tools/__tests__/pagetools.test.ts`
- `workers/business-agent/src/services/__tests__/*.test.ts`
- `workers/business-agent/tests/index.test.ts`
- `src/__tests__/auction.test.ts` (uncommitted, in `.worktrees/admin-displayandbusiness-display`)

## Naming Conventions

**Files:**
- Plain TypeScript modules: camelCase, e.g., `database.ts`, `admin.ts`.
- React components: PascalCase `.tsx`, e.g., `PreviewPane.tsx`, `AtlasLiveView.tsx`.
- Worker entry files: `index.ts` or `server.ts`.
- Migration files: inconsistent today (`003_...`, `004_...`, `006_...`, timestamped in `backend/migrations`).
  - **Recommended:** `migrations/NNN_description.sql` with sequential three-digit numbers.
- Documentation: UPPERCASE with underscores, e.g., `FEATURES.md`, `CI_CD_SETUP.md`.

**Directories:**
- Worker projects: lowercase with hyphens, e.g., `analyzer-worker`, `facebook-worker`, `business-agent`.
- Feature folders: kebab-case, e.g., `preview-pane/`, `components/atlas/`.
- Component category templates: lowercase, e.g., `hero/`, `gallery/`.

**Env Bindings / Constants:**
- Bindings use UPPER_SNAKE_CASE: `DB`, `CACHE`, `IMAGES`, `ANALYZER`.
- Secrets declared in `[vars]`/`vars` are hardcoded in some configs; sensitive secrets should be set via `wrangler secret put`.

## Where to Add New Code

**New Public Route or Page (Main Worker):**
- Primary handler: `src/index.ts` route block.
- Reusable logic: new helper file `src/<feature>.ts`.
- Database queries: extend `src/database.ts` `DatabaseService`.
- Schema change: add `migrations/NNN_<feature>.sql` and apply to D1.
- UI rendering: extend `src/templates.ts` or inline HTML in `src/index.ts`.

**New Admin Feature:**
- Primary code: `src/admin.ts` action handler block.
- Auth check: reuse `verifyAdminSession` from `src/auth/google.ts`.

**New Authentication Provider:**
- Provider implementation: `src/auth/<provider>.ts`.
- Middleware helpers: `src/auth/middleware.ts`.
- Env types: `src/types.ts`.

**New Background Job (Main Worker Cron):**
- Job module: `src/workers/<job>Worker.ts`.
- Cron registration: `wrangler.toml` `[triggers] crons`.
- Invocation: call from `src/index.ts` `scheduled` handler.

**New Satellite Worker:**
- Create `workers/<name>/` with `wrangler.toml`, `package.json`, `tsconfig.json`, `src/index.ts`.
- Add deploy script to root `package.json`.
- Add deploy job to `.github/workflows/deploy.yml`.

**New Business-Agent Tool:**
- Implementation: `workers/business-agent/src/tools/<tool>.ts`.
- Registration: `workers/business-agent/src/tools/index.ts`.
- Tests: `workers/business-agent/src/tools/__tests__/<tool>.test.ts`.

**New Page Template for R2 Publishing:**
- Component HTML: `templates/<category>/<template-name>.html`.
- Load/render: `workers/business-agent/src/services/template-loader.ts` and `component-renderer.ts`.

**New Static Asset / Image Upload:**
- AI-generated images → R2 bucket `IMAGES` (`kiamichi-biz-images`).
- Business owner uploads → R2 bucket `BUSINESS_IMAGES` (`kiamichi-business-images`).
- Published pages → R2 bucket `BUSINESS_ASSETS` (`kiamichi-business-assets`).
- Component templates → R2 bucket `TEMPLATES` (`kiamichi-component-templates`).

**New Test:**
- Business-agent: co-located `__tests__/<feature>.test.ts` or `workers/business-agent/tests/<feature>.test.ts`.
- Main worker: currently no test directory; create `src/__tests__/<feature>.test.ts` (needs a Vitest setup first).

## Special Directories

**`.worktrees/`:**
- Purpose: Active git worktrees for parallel feature work.
- Generated: No, managed by `git worktree`.
- Committed: No (untracked in main).
- Current content: `admin/displayandBusiness/display` branch with sponsored auction work in progress.

**`dist/`:**
- Purpose: Build output from `workers/business-agent` Vite build.
- Generated: Yes.
- Committed: No.

**`.wrangler/`:**
- Purpose: Local Wrangler state (KV, D1 local files).
- Generated: Yes.
- Committed: No.

**`node_modules/`:**
- Purpose: Installed dependencies.
- Generated: Yes.
- Committed: No.

**`backend/`:**
- Purpose: Import SQL scripts and migrations.
- Generated: Partially (import scripts generate SQL).
- Committed: Yes, for import migrations.

**`Businessdata/` / `branding/`:**
- Purpose: Business and brand assets (logos, images, data exports).
- Generated: No, static assets.
- Committed: Yes.

**`public/`:**
- Purpose: Static files not processed by build.
- Note: Not wired as a public directory in Wrangler; `robots.txt` is served from code at `src/index.ts`.

---

*Structure analysis: 2026-08-25*
