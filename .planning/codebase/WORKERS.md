# Worker Subprojects

**Analysis Date:** 2026-08-25

## Overview

The project deploys four separate Cloudflare Workers. They share a single D1 database (`kiamichi-biz-connect-db`), one KV namespace (`CACHE`), and several R2 buckets, but each worker has its own entry point, triggers, and bindings.

| Worker | Entry Point | Wrangler Config | Purpose | Deployment Script |
|--------|-------------|-----------------|---------|-------------------|
| Main site | `src/index.ts` | `wrangler.toml` | Public site, admin UI, OAuth, blog cron | `npm run deploy` |
| Analyzer | `workers/analyzer-worker/src/index.ts` | `workers/analyzer-worker/wrangler.toml` | AI listing enrichment and scoring | `npm run deploy:analyzer` |
| Facebook | `workers/facebook-worker/src/index.ts` | `workers/facebook-worker/wrangler.toml` | Scheduled Facebook posting, token refresh, analytics | `npm run deploy:facebook` |
| Business Agent | `workers/business-agent/src/server.ts` | `workers/business-agent/wrangler.jsonc` | Owner portal, AI chat, page preview/publish | `npm run deploy:business` |

---

## 1. Analyzer Worker — `workers/analyzer-worker/`

### Purpose
AI-driven enrichment worker that scores business listing completeness and either stores suggestions for admin review (manual mode) or conservatively applies high-confidence updates (auto mode).

### Configuration
- Name: `kiamichi-biz-ai-analyzer`
- Main module: `workers/analyzer-worker/src/index.ts`
- TypeScript project: `workers/analyzer-worker/tsconfig.json`
- Cron: 3 times daily (`0 14 * * *`, `0 20 * * *`, `0 2 * * *`) per `workers/analyzer-worker/wrangler.toml`
- Bindings: `DB`, `AI`, `IMAGES`, `CACHE`
- Vars: `SITE_NAME`, `SITE_URL`, `MAIN_WORKER_URL`, `ANALYZER_VERSION`, `MAX_AUTO_UPDATES_PER_DAY`, `AUTO_APPLY_CONFIDENCE_THRESHOLD`, `USE_CODE_MODE`
- Secret: `ADMIN_KEY`

### HTTP Endpoints
| Method | Path | Handler | Notes |
|--------|------|---------|-------|
| POST | `/analyze` | `analyzeBusiness` | Manual enrichment request. |
| GET | `/health` | — | Returns version and timestamp. |
| GET | `/analysis/:businessId` | `getLatestAnalysis` | Latest stored analysis JSON. |
| GET | `/test-cron` | `runCodeModeCron` | Admin-key gated Code Mode test. |

### Cron Behavior
- With `USE_CODE_MODE === 'true'`, runs `workers/analyzer-worker/src/codemode-cron.ts`.
- Otherwise, fetches up to 20 incomplete businesses, analyzes the first 10, and auto-applies suggestions above the configured confidence threshold (default 0.95).
- Sleeps 2 seconds between businesses.

### Implemented Features
- Completeness scoring (0-100) over 12 weighted fields in `workers/analyzer-worker/src/analyzer.ts`.
- AI enrichment planning via `env.AI.run('@cf/meta/llama-3.1-8b-instruct', ...)`.
- Web scraping/extraction in `workers/analyzer-worker/src/webTools.ts`.
- D1 helpers in `workers/analyzer-worker/src/database.ts`.

### Gaps / Risks
- **SQL injection risk:** `applyAutoUpdates` interpolates `suggestion.field` into an `UPDATE` statement.
- No tests or build/type-check scripts.
- No admin approval endpoint inside the worker; approvals happen via main worker `/admin?action=review-suggestion`.
- Web tools only scrape the existing website; no external search engine integration.

---

## 2. Facebook Worker — `workers/facebook-worker/`

### Purpose
Standalone Facebook automation worker. Schedules and posts content to the Kiamichi Biz Connect Facebook Page and Group, refreshes tokens, rotates featured businesses, runs VIP content, captures analytics, and can fall back to browser automation.

### Configuration
- Name: `kiamichi-facebook-worker`
- Main module: `workers/facebook-worker/src/index.ts`
- Cron: `0 0 * * *`, `0 2,14 * * *`, `0 3,15,22 * * *` per `workers/facebook-worker/wrangler.toml`
- Bindings: `DB`, `AI`, `IMAGES`, `CACHE`, `BROWSER`, `BROWSER_SESSION` Durable Object
- Vars: `SITE_URL`, `SESSION_LIFETIME_HOURS`, `FB_PROFILE_ID`, `FB_PAGE_ID`, `FB_GROUP_ID`, `FB_APP_ID`
- Secrets: `FB_EMAIL`, `FB_PASSWORD`, `FACEBOOK_APP_SECRET` (optionally `FB_ACCESS_TOKEN`, `FB_PAGE_ACCESS_TOKEN`)

### HTTP Endpoints
| Path | Purpose |
|------|---------|
| `/post` | Post to page/group via official Graph API. |
| `/test-post` | Generate AI content and post a test. |
| `/trigger-queue` | On-demand queue processing (called by business-agent). |
| `/run` | Manually run scheduled tasks. |
| `/refresh-token` | Extend page access token. |
| `/queue/status` | Pending/failed queue summary. |
| `/analytics/summary` | Aggregate analytics summary. |
| `/schedule/preview` | Preview upcoming schedule. |
| `/webhooks/facebook` | Facebook webhook receiver (stub). |
| `/data-deletion` | Facebook data-deletion callback. |
| `/featured/*` | Featured business rotation CRUD. |
| `/vip/*` | VIP business configuration CRUD. |
| `/api/facebook/auto-post` | Sage/auto trigger from business-agent. |
| `/browser-login`, `/browser-status` | Debug endpoints for browser automation. |

### Implemented Features
- Official Graph API posting in `workers/facebook-worker/src/fb-official-api.ts`.
- GraphQL posting shim in `workers/facebook-worker/src/fb-graphql-api.ts`.
- Browser automation Durable Object in `workers/facebook-worker/src/browser-session.ts`.
- Featured rotation in `workers/facebook-worker/src/featured-rotation.ts`.
- VIP content generation in `workers/facebook-worker/src/vip-posts.ts`.
- Content queue management via shared `facebook_content_queue` table.

### Gaps / Risks
- **Critical runtime bug:** `cookies.find(...)` is used before `cookies` is declared in `workers/facebook-worker/src/browser-session.ts`.
- **VIP posts are not published:** `processVIPBusinesses()` generates content but stops short of calling `officialPostToPage`.
- Token refresh does not persist the new secret automatically.
- Webhook handler logs the body but does not process it.
- GraphQL posting relies on hardcoded Facebook GraphQL doc IDs and hashes.
- Several endpoints lack authentication.

---

## 3. Business-Agent Worker — `workers/business-agent/`

### Purpose
React-based business owner portal hosted on `app.kiamichibizconnect.com`. It provides an AI chat agent (`Chi`) that helps owners edit listings, generate content, preview changes, publish snapshots, schedule social posts, and interact with voice/Atlas live view features.

### Configuration
- Name: `kiamichi-business-agent`
- Main module: `workers/business-agent/src/server.ts`
- Route: `app.kiamichibizconnect.com/*`
- Bindings: `DB`, `AI`, `CACHE`, `TEMPLATES`, `BUSINESS_ASSETS`, `IMAGES`, `BUSINESS_IMAGES`
- Service bindings: `ANALYZER` → `kiamichi-biz-ai-analyzer`, `RAG_AGENT` → `purple-snow-f107-nlweb`, `FACEBOOK_WORKER` → `kiamichi-facebook-worker`
- Durable Objects: `Chat`, `VoiceAgent`, `AtlasLive`
- Vars: `GOOGLE_CLIENT_ID`

### Entry-Point Flow (`server.ts`)
1. Non-agent routes (`/health`, `/preview/:businessId`, `/api/*`, `/mcp/*`, `/voice/*`, `/api/atlas/live`) are handled directly.
2. Agent routes are routed through `routeAgentRequest` from the Agents SDK.
3. `Chat` Durable Object is instantiated per connection; it checks for the `admin_session` cookie and loads business context from D1.

### React App (`app.tsx`)
- Split-pane chat + preview UI.
- Theme toggle, publish dialog, Atlas live view panel.
- Voice WebSocket client controls (currently relies on browser APIs and the `VoiceAgent` DO).

### API Routes (`workers/business-agent/src/routes/api.ts`)
- `GET /api/my-business` — returns the current user's business; supports `?business_id=` override for admin.
- `POST /api/publish` — creates a snapshot and publishes HTML to R2.
- `GET /api/user-info` — session/user info.
- `GET /api/businesses`, `GET /api/business/:id` — admin business lookup.

### Preview Route (`workers/business-agent/src/routes/preview.ts`)
- Authenticates via `admin_session` / `portal_session`.
- Verifies business ownership.
- Renders draft HTML via `PageAssembler` with a preview banner.

### Tools (`workers/business-agent/src/tools/*`)
- `pagetools.ts` — 9 page editing tools (list, add, edit, remove, reorder, publish, rollback, snapshots).
- `contenttools.ts` — content generation.
- `facebooktools.ts` — social post draft/image/publish; calls `FACEBOOK_WORKER` for queue triggers.
- `dbtools.ts` — database introspection.
- `scheduletools.ts` — scheduling helpers.

### Services (`workers/business-agent/src/services/*`)
- `TemplateLoader` — loads component templates from R2 with caching.
- `ComponentRenderer` — Handlebars rendering with business data.
- `PageAssembler` — full HTML page assembly and R2 upload.

### Implemented Features
- AI chat with tool calling.
- Split-screen preview and publish.
- Page snapshot version control.
- Social post delegation to Facebook worker.
- Atlas live view Durable Object for real-time activity.
- Voice agent scaffolding.

### Gaps / Risks
- **Duplicate `.ts` and `.js` files** create maintenance confusion.
- **`zod` is imported but not declared** in `package.json`.
- **Voice path is mocked** in `business-agent-voice-ui` branch; real STT/TTS not wired.
- **MCP disconnect handler** is a stub.
- **No service binding back to the main worker**; relies on shared cookie + direct D1 access.
- **Published pages are not served by the main worker**; `handleBusinessPage` still renders from D1.

---

## Integration Map

```
                 ┌─────────────────────┐
                 │   Main Worker       │
                 │   kiamichi-biz-connect
                 └──────────┬──────────┘
                            │ OAuth session cookie (admin_session)
                            │ service binding ANALYZER
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌─────────▼─────────┐  ┌──────▼──────┐
│ Analyzer     │  │ Business Agent    │  │ Facebook    │
│ Worker       │  │ kiamichi-business-agent │ Worker     │
└───────┬──────┘  └─────────┬─────────┘  └──────┬──────┘
        │                   │                   │
        └───────────┬─────────┴─────────┬─────────┘
                    │                   │
              ┌─────▼─────┐      ┌──────▼──────┐
              │ D1 DB     │      │ KV / R2     │
              │ (shared)  │      │ (shared)    │
              └───────────┘      └─────────────┘
```

- All four workers read/write the same D1 database. Schema changes must be coordinated.
- Two workers (main and business-agent) render business pages; only the agent writes published R2 pages.
- Facebook worker and business-agent both write to `facebook_content_queue`; the worker acts as the consumer.

---

## Deployment Status

| Worker | Build/Deploy | Notes |
|--------|--------------|-------|
| Main | Raw TS deployed via `wrangler deploy`; no build step. | Bundle ~1.7 MB. |
| Analyzer | Raw TS deployed via `wrangler deploy`; no build/type-check script. | Deployed through root `deploy:analyzer`. |
| Facebook | Raw TS deployed via `wrangler deploy`; no build script. | Depends on `@cloudflare/puppeteer`. |
| Business-Agent | Vite build (`npm run build`) then `wrangler deploy` via `scripts/fix-spa-routing.js`. | Largest build; React + Agents SDK client. |

---

*Worker subproject analysis: 2026-08-25*
