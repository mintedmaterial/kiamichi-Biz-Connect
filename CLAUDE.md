# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KiamichiBizConnect is a local business directory for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas. It runs entirely on Cloudflare Workers with D1, R2, KV, Workers AI, Browser Rendering, and the Agents SDK.

- **Production**: https://kiamichibizconnect.com
- **App (AI Agent)**: https://app.kiamichibizconnect.com

## Commands

### Development
```bash
npm run dev                    # Run main worker locally (port 8787)
cd workers/business-agent && npm run dev  # Run business-agent locally (Vite + Workers)
```

### Build & Deploy
```bash
npm run build                  # Build business-agent (Vite)
npm run deploy                 # Deploy main worker
npm run deploy:all             # Deploy all workers (analyzer, facebook, business-agent)
npm run deploy:analyzer        # Deploy analyzer worker only
npm run deploy:facebook        # Deploy facebook worker only
npm run deploy:business        # Deploy business-agent only
```

### Database
```bash
npm run db:schema:local        # Apply schema.sql to local D1
npm run db:schema:remote       # Apply schema.sql to production D1
npm run db:seed:local          # Seed local D1 with seed.sql
npm run db:seed:remote         # Seed production D1
```
Migrations are in `migrations/` and applied via `wrangler d1 migrations apply`.

### Testing & Linting (business-agent)
```bash
cd workers/business-agent
npm run test:unit              # Unit tests (Vitest, Node env, src/**/__tests__/**/*.test.ts)
npm run test                   # All tests (Vitest)
npm run check                  # Prettier + Biome lint + tsc
npm run format                 # Prettier --write
npm run types                  # Generate env.d.ts from wrangler config
```

### Logs
```bash
npm run tail                   # Tail live worker logs
```

## Architecture

### Multi-Worker Monorepo

Four Cloudflare Workers communicate via service bindings:

1. **Main Worker** (`src/index.ts`, `wrangler.toml`) - Public business directory site. Server-rendered HTML with Handlebars templates. Handles business listings, search, categories, blog, Google/Facebook OAuth, and admin dashboard. Routes: `kiamichibizconnect.com/*`

2. **Business Agent** (`workers/business-agent/`, `wrangler.jsonc`) - AI-powered SPA at `app.kiamichibizconnect.com`. React 19 + Vite 7 + Tailwind v4 frontend. Uses Cloudflare Agents SDK with Durable Objects:
   - `Chat` (AIChatAgent) - AI chat with business context, tool-based architecture
   - `VoiceAgent` - Voice interaction
   - `SocialPostWorkflow` (Workflow) - 3-step social media posting: draft -> image -> approval -> publish

3. **Analyzer Worker** (`workers/analyzer-worker/`) - Cron-triggered (3x daily) autonomous business data enrichment using Workers AI. Confidence-scored auto-updates.

4. **Facebook Worker** (`workers/facebook-worker/`) - Automated Facebook posting via Browser Rendering (Puppeteer). Cron schedule: 9am/4pm/9pm CST. Uses a Durable Object (`BrowserSession`) for persistent browser sessions.

### Service Binding Graph
```
Main Worker ──> Analyzer, Facebook Worker, RAG Agent
Business Agent ──> Analyzer, Facebook Worker, RAG Agent
```

### Data Layer
- **D1** (binding: `DB`) - Single shared database `kiamichi-biz-connect-db`. Core tables: `businesses`, `categories`, `blog_posts`, `ad_placements`, `business_submissions`, `facebook_posts`, `social_media_images`
- **R2 Buckets**: `IMAGES` (AI-generated), `BUSINESS_IMAGES` (user-uploaded), `BUSINESS_ASSETS` (published HTML), `TEMPLATES` (component templates)
- **KV** (binding: `CACHE`) - Response caching layer

### AI Agent Tools (business-agent)
The Chat agent uses a tool-based architecture defined in `workers/business-agent/src/tools/`:
- `dbtools.ts` - Database queries and business data
- `contenttools.ts` - AI content generation
- `facebooktools.ts` - Facebook posting integration
- `pagetools.ts` - Page/site management
- `scheduletools.ts` - Task scheduling via `this.schedule()`

### Key Patterns
- Main worker uses vanilla `fetch()` handler with manual URL routing (no framework)
- Business agent extends `AIChatAgent` from `agents/ai-chat-agent` with `this.sql` for SQLite, `this.setState()` for state sync
- Workers AI model: `@cf/meta/llama-4-scout-17b-16e-instruct` via `@cloudflare/ai-chat`
- Durable Object migrations use `new_sqlite_classes` in wrangler config
- Workflows use `WorkflowEntrypoint` with step-based execution and retry logic
- Frontend connects to agent via `useAgent` hook from `agents/react`

## Cloudflare Conventions
- Use `wrangler.jsonc` for new workers (main worker still uses `wrangler.toml`)
- Always set `compatibility_flags = ["nodejs_compat"]`
- Always enable observability: `"observability": { "enabled": true }`
- Use WebSocket Hibernation API (not legacy) for Durable Objects
- Use `this.ctx.acceptWebSocket(server)` not `server.accept()`
- ES modules format only (no Service Worker format)
- Prefer structured JSON outputs for AI responses

## CI/CD
GitHub Actions in `.github/workflows/`:
- `ci.yml` - Type checking, lint, build validation, unit tests, security audit
- `deploy.yml` - Push-to-main deploy: migrations check -> apply -> parallel worker deploy
- `preview.yml` - Preview deployments for PRs

## Custom Agents
Project-specific Claude Code agents are in `.claude/agents/` for specialized tasks (API design, Cloudflare Workers, Durable Objects, frontend, GIS/mapping, payments, etc.).
