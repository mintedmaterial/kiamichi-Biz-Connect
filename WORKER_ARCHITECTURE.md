# Worker Architecture Explanation

## Directory Structure

Your project uses **TWO DIFFERENT PATTERNS** for workers - this is normal and correct:

### Pattern 1: Main Worker (`src/`)
```
src/
├── index.ts              # Main entry point (deployed as "kiamichi-biz-connect")
├── admin.ts              # Admin panel logic
├── database.ts           # Database helpers
├── templates.ts          # HTML templates
├── types.ts              # TypeScript interfaces
└── workers/              # ⚠️ NOT separate workers - just helper modules
    ├── blogWorker.ts     # Blog generation helpers (imported by index.ts)
    └── facebookWorker.ts # Facebook helpers (imported by index.ts)
```

**What this means:**
- `src/index.ts` is the **main worker** deployed to `kiamichibizconnect.com`
- `src/workers/` contains **helper functions**, NOT separate Cloudflare Workers
- These helpers are imported and used within `src/index.ts`
- There's only ONE `wrangler.toml` at the root controlling this

### Pattern 2: Separate Workers (`workers/`)
```
workers/
├── facebook-worker/
│   ├── src/
│   │   └── index.ts           # Separate worker entry point
│   ├── wrangler.toml          # Its own configuration
│   └── package.json           # Its own dependencies
└── analyzer-worker/
    ├── src/
    │   ├── index.ts           # Separate worker entry point
    │   ├── types.ts           # Its own types
    │   ├── analyzer.ts        # AI analysis logic
    │   ├── webTools.ts        # Web scraping
    │   └── database.ts        # Database operations
    ├── wrangler.toml          # Its own configuration
    ├── package.json           # Its own dependencies
    └── tsconfig.json          # TypeScript config
```

**What this means:**
- Each subdirectory in `workers/` is a **completely separate Cloudflare Worker**
- Each has its own `wrangler.toml`, `package.json`, and deployment
- Each is deployed independently with `wrangler deploy`
- They communicate with the main worker via **Service Bindings**

## How Multiple wrangler.toml Files Work

### Main Worker (`wrangler.toml` at root)
```toml
name = "kiamichi-biz-connect"
main = "src/index.ts"
routes = ["kiamichibizconnect.com/*"]

# Service bindings connect to other workers
[[services]]
binding = "ANALYZER"
service = "kiamichi-biz-ai-analyzer"
```

This deploys ONE worker from `src/index.ts` to your domain.

### Analyzer Worker (`workers/analyzer-worker/wrangler.toml`)
```toml
name = "kiamichi-biz-ai-analyzer"
main = "src/index.ts"

# Cron schedule for autonomous runs
[triggers]
crons = ["0 14 * * *", "0 20 * * *", "0 2 * * *"]
```

This deploys a SECOND worker that:
- Runs independently on its own URL
- Has its own cron triggers
- Is called by the main worker via service binding

### Facebook Worker (`workers/facebook-worker/wrangler.toml`)
```toml
name = "kiamichi-biz-facebook-worker"
main = "src/index.ts"
```

This deploys a THIRD worker for Facebook operations.

## How They Work Together

```
┌─────────────────────────────────────────┐
│   Main Worker (kiamichi-biz-connect)    │
│   URL: kiamichibizconnect.com           │
│   Code: src/index.ts                    │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────┐    │
│  │ env.ANALYZER.fetch()           │─────┼──────> Analyzer Worker
│  │ (service binding)              │    │        (kiamichi-biz-ai-analyzer)
│  └────────────────────────────────┘    │        Cron: 3x daily
│                                         │
│  Uses helpers from src/workers/        │
│  - blogWorker.ts (not a worker!)       │
│  - facebookWorker.ts (not a worker!)   │
│                                         │
└─────────────────────────────────────────┘
```

## Deployment Process

### Deploy Main Worker
```bash
# From project root
npx wrangler deploy
```

This reads `wrangler.toml` and deploys `src/index.ts` to your domain.

### Deploy Analyzer Worker
```bash
# From workers/analyzer-worker/
cd workers/analyzer-worker
npx wrangler deploy
```

This reads `workers/analyzer-worker/wrangler.toml` and deploys that worker separately.

### Deploy Facebook Worker
```bash
# From workers/facebook-worker/
cd workers/facebook-worker
npx wrangler deploy
```

## Service Bindings (How Workers Talk)

The main worker can call other workers **without HTTP** using service bindings:

```typescript
// In src/index.ts (main worker)
const response = await env.ANALYZER.fetch('https://analyzer/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ businessId: 123, mode: 'manual' })
});
```

This is **MUCH faster** than HTTP because it:
- Runs on Cloudflare's internal network
- No DNS lookup needed
- No TLS handshake
- Sub-millisecond latency

## Why This Pattern?

### Benefits of Separate Workers:
1. **Isolation**: Analyzer has its own CPU limits and doesn't affect main app
2. **Cron Triggers**: Analyzer runs on schedule independently
3. **Independent Scaling**: Each worker scales separately
4. **Code Organization**: Clear separation of concerns
5. **Independent Deployment**: Can deploy analyzer without touching main app

### When to Use Helper Modules (src/workers/) vs Separate Workers (workers/):

**Use Helper Modules (`src/workers/`) when:**
- Logic is tightly coupled to main app
- No need for separate cron triggers
- Sharing same execution context is fine
- Example: Template rendering, utility functions

**Use Separate Workers (`workers/`) when:**
- Need independent cron schedule
- CPU-intensive tasks that shouldn't block main app
- Want to deploy separately
- Different teams maintain different workers
- Example: Background jobs, AI analysis, data processing

## Summary

✅ **CORRECT**: You have both patterns, and this is intentional
- `src/workers/` = Helper modules imported by main worker
- `workers/` = Completely separate Cloudflare Workers

❌ **NOT CONFUSING**: Each pattern serves a different purpose

📝 **REMEMBER**:
- Only `workers/*/` directories need their own `wrangler.toml`
- `src/workers/` files are just TypeScript modules
- Service bindings connect separate workers together
- Each separate worker deploys independently

This is a **monorepo pattern** and is recommended by Cloudflare for complex applications!
