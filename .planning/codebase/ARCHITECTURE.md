# Architecture

**Analysis Date:** 2026-08-25

## Pattern Overview

**Overall:** Serverless multi-worker application on Cloudflare Workers with a monolithic main worker, three satellite workers, shared D1/R2/KV stores, and service bindings between workers.

**Key Characteristics:**
- All state lives in Cloudflare managed services; workers are stateless except for Durable Objects.
- The main worker (`kiamichi-biz-connect`) handles public site traffic, admin UI, and OAuth.
- Specialized workers handle background analysis (`kiamichi-biz-ai-analyzer`), Facebook automation (`kiamichi-facebook-worker`), and the business-owner portal (`kiamichi-business-agent`).
- Shared SQLite database (`kiamichi-biz-connect-db`) is the single source of truth.
- R2 buckets separate asset types: `IMAGES` for AI/social content, `BUSINESS_IMAGES` for owner uploads, `BUSINESS_ASSETS` for published static pages, `TEMPLATES` for page components.
- KV (`CACHE`) is used for short-lived caching (sitemap, tokens, sessions).

## Layers

**Router / Handlers:**
- Purpose: HTTP routing and request handling.
- Location: `src/index.ts` (main worker), `workers/business-agent/src/server.ts`.
- Contains: inline route matching, page handlers, API handlers, OAuth callbacks.
- Depends on: `src/database.ts`, `src/templates.ts`, `src/auth/*`, `src/workers/*`, `src/facebook-*`, R2/KV/D1 bindings.
- Used by: All public traffic and the admin panel.

**Database Service Layer:**
- Purpose: Encapsulate D1 queries in parameterized prepared statements.
- Location: `src/database.ts`.
- Contains: `DatabaseService`, CRUD for businesses, categories, submissions, blogs, leads, ads, stats.
- Depends on: D1 binding `DB`.
- Used by: `src/index.ts`, `src/admin.ts`, `src/workers/blogWorker.ts`.

**Authentication Layer:**
- Purpose: Admin session creation and verification.
- Location: `src/auth/google.ts`, `src/auth/facebook-admin.ts`, `src/auth/github.ts`, `src/auth/middleware.ts`, `src/auth/types.ts`.
- Contains: OAuth handlers, `admin_sessions` persistence in D1, cookie management, `requireAdminAuth` helpers.
- Depends on: D1, KV, Google/Facebook/GitHub OAuth secrets.
- Used by: `src/index.ts`, `src/admin.ts`, `workers/business-agent/src/server.ts`.

**Admin & CMS Layer:**
- Purpose: Server-rendered admin dashboard and content tools.
- Location: `src/admin.ts`.
- Contains: Business management, blog generator, lead management, AI analyzer proxy.
- Depends on: `DatabaseService`, OAuth sessions, `src/workers/blogWorker.ts`, `ANALYZER` service binding.
- Used by: Authenticated admins via `/admin?action=*`.

**Templates / UI Layer:**
- Purpose: HTML/CSS generation and Facebook SDK bootstrap.
- Location: `src/templates.ts`.
- Contains: `htmlTemplate` wrapper, dark-themed Tailwind styles, homepage content helper, Facebook SDK injection.
- Depends on: `env.SITE_NAME`, `env.FB_APP_ID`, `env.FB_API_VERSION`.
- Used by: Every HTML page produced by the main worker.

**Facebook Integration Layer:**
- Purpose: OAuth, posting, scheduling, content generation, page enrichment.
- Location: `src/facebook-oauth.ts`, `src/facebook-graph-api.ts`, `src/facebook-scheduler.ts`, `src/facebook-content-generator.ts`, `src/facebook-ai-analyzer.ts`, `src/bigfoot-mascot.ts`.
- Contains: Graph API wrappers, content queue logic, AI prompts, mascot image generation.
- Depends on: D1, KV, R2 `IMAGES`, Workers AI `AI`.
- Used by: Main worker routes, `workers/facebook-worker`.

**Background Workers:**
- Purpose: Cron-triggered and async automation.
- Location: `src/workers/blogWorker.ts`, `src/workers/facebookWorker.ts`.
- Contains: Daily blog generation, Facebook queue processing.
- Depends on: D1, R2, KV, Workers AI.
- Triggered by: `scheduled` handler in `src/index.ts` (cron at 14:15 UTC).

**Satellite Workers:**
- Analyzer worker: `workers/analyzer-worker/src/index.ts`
  - Enrichment, completeness scoring, autonomous updates.
  - Reads from shared D1; exposes `/analyze` and cron.
- Facebook worker: `workers/facebook-worker/src/index.ts`
  - Dedicated Facebook posting, token refresh, analytics, browser automation.
  - Has its own Browser Rendering `BROWSER` binding and `BROWSER_SESSION` Durable Object.
- Business agent: `workers/business-agent/src/server.ts`
  - React owner portal on `app.kiamichibizconnect.com`.
  - `AIChatAgent` (`Chat`) Durable Object, `VoiceAgent`, `AtlasLive`.
  - Service bindings to `ANALYZER`, `FACEBOOK_WORKER`, `RAG_AGENT`.

## Data Flow

**Public Homepage:**

1. Request hits `src/index.ts` `fetch` handler.
2. `handleHomepage` instantiates `DatabaseService`.
3. `DatabaseService.getAllCategories`, `getFeaturedBusinesses`, `getStats`, `getRecentBlogPosts` query D1 in parallel.
4. `homepageContent` builds HTML snippets from the data.
5. `htmlTemplate` wraps the content and returns the response.

**Business Search with AI Overlay:**

1. `GET /search?q=...` reaches `handleSearch` in `src/index.ts`.
2. `DatabaseService.searchBusinesses` runs a LIKE + category/city query against D1.
3. If the query looks like natural language, the worker fetches `https://purple-snow-f107-nlweb.srvcflo.workers.dev/ask`.
4. Results are parsed from SSE-style `data:` lines and resolved against D1 for clean business data.
5. HTML response mixes AI answer cards with database results.

**Admin Business Save:**

1. `POST /admin?action=save-business&id=...` reaches `handleAdminPage` in `src/admin.ts`.
2. Session is verified via `verifyAdminSession`.
3. `saveBusiness` parses JSON and calls `DatabaseService.createBusiness` or `updateBusiness`.
4. D1 `businesses` table is updated with parameterized SQL.
5. JSON success response is returned to the admin editor.

**Daily Automated Blog:**

1. Cron (14:15 UTC) triggers `scheduled` in `src/index.ts`.
2. `runDailyBlogAutomation` calls `runAutomatedDailyBlog` from `src/workers/blogWorker.ts`.
3. Worker uses `env.AI` to generate text and `@cf/black-forest-labs/flux-1-dev` for images.
4. Draft blog post and candidate images are stored in D1; one image is auto-approved.
5. Post is marked published; details are logged.

**Business-Agent Preview / Publish:**

1. Owner authenticates on main site; `admin_session` cookie is shared across `*.kiamichibizconnect.com`.
2. `app.kiamichibizconnect.com` request hits `workers/business-agent/src/server.ts`.
3. `Chat` Durable Object handles chat via the Agents SDK; tools modify `page_snapshots` in D1.
4. `GET /preview/:businessId` in `workers/business-agent/src/routes/preview.ts` renders via `PageAssembler`.
5. On publish, `PageAssembler` generates static HTML and writes to R2 `BUSINESS_ASSETS` (`business/{slug}/index.html`).
6. Main worker currently does **not** serve these published pages; it still renders business pages from D1.

**Facebook Automation Worker:**

1. Cron triggers `workers/facebook-worker/src/index.ts`.
2. Token refresh, featured rotation, VIP posts, queue processing run in sequence.
3. `fb-official-api.ts` posts to the configured page/group.
4. Analytics are written back to `facebook_post_analytics`.

## Key Abstractions

**`DatabaseService` (`src/database.ts`):**
- Purpose: Centralize D1 access and enforce prepared statements.
- Pattern: Single class wrapping `D1Database`; each method runs one query or a small parallel batch.

**`htmlTemplate` (`src/templates.ts`):**
- Purpose: Provide consistent HTML shell and shared CSS.
- Pattern: Template literal function returning a full HTML document; injects Tailwind CDN and Facebook SDK.

**`runAutomatedDailyBlog` (`src/workers/blogWorker.ts`):**
- Purpose: Encapsulate the end-to-end daily blog cron.
- Pattern: Returns a result object `{ success, blog_id, title, slug, ... }` consumed by the `scheduled` handler.

**`AIChatAgent` / `Chat` (`workers/business-agent/src/server.ts` + related files):**
- Purpose: Stateful per-owner chat agent with tool calling.
- Pattern: Cloudflare Agents SDK Durable Object; tools in `workers/business-agent/src/tools/*`.

**`PageAssembler` / `ComponentRenderer` / `TemplateLoader` (`workers/business-agent/src/services/*`):**
- Purpose: Render owner-edited business pages from R2 templates and D1 business data.
- Pattern: Service pipeline: load template → render with Handlebars → assemble full HTML.

## Entry Points

**Main Worker:**
- Location: `src/index.ts`
- Triggers: HTTP `fetch`, daily cron `scheduled`.
- Responsibilities: Public site, admin panel, OAuth, search, sitemap, static assets from R2, blog cron.

**Analyzer Worker:**
- Location: `workers/analyzer-worker/src/index.ts`
- Triggers: HTTP `/analyze`, `/health`, `/analysis/:id`, cron.
- Responsibilities: Business completeness scoring, enrichment suggestions, autonomous updates.

**Facebook Worker:**
- Location: `workers/facebook-worker/src/index.ts`
- Triggers: HTTP endpoints, cron.
- Responsibilities: Scheduled Facebook posts, token refresh, analytics, featured rotation.

**Business Agent:**
- Location: `workers/business-agent/src/server.ts`
- Triggers: HTTP requests to `app.kiamichibizconnect.com`.
- Responsibilities: Chat portal, preview/publish, voice, Atlas live view, social post delegation.

## Error Handling

**Strategy:** Ad-hoc try/catch at route boundaries with `console.error` logging and generic 500 responses.

**Patterns:**
- Outer `try/catch` in `src/index.ts` `fetch` returns `new Response('Internal Server Error', { status: 500 })`.
- Individual handlers (e.g., image serving, search) catch errors and return 404/500 with context.
- `src/admin.ts` returns JSON `{ error: ... }` on failures.
- Background `scheduled` handler throws on blog failure so the cron is logged as failed.

**Gaps:** No centralized error tracking service in `main`; some branches include Sentry but it is not merged. Unhandled promise rejections inside `ctx.waitUntil` rely on Worker logging.

## Cross-Cutting Concerns

**Logging:** Uses `console.log`/`console.error` heavily; wrangler observability is enabled. No structured logging library.

**Validation:** Manual in each handler (regex for emails, string checks for required fields). No shared validation schema; `zod` is used in `workers/business-agent/src/tools/*` but not in the main worker.

**Authentication:** Session cookies stored in D1 (`admin_sessions`). Main worker issues cookies for `.kiamichibizconnect.com`; business-agent reads the same cookie. OAuth providers: Google, Facebook, GitHub.

**Authorization:**
- Admin routes check OAuth session and authorized email list / `site_admins` table.
- Business-agent checks `portal_session` or `admin_session` and verifies business ownership.

**Caching:**
- KV for sitemap (1 hour), image headers (immutable), search/category pages use short browser cache.
- No application-level data cache in front of D1.

---

*Architecture analysis: 2026-08-25*
