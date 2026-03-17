# AGENTS.md — KiamichiBizConnect

AI coding agents working in this repository should follow these rules.

## Project Overview

Local business directory platform for Southeast Oklahoma, Northeast Texas, and Southwest Arkansas. Full-stack Cloudflare Workers app with business listings, search, blog, and ad placement.

**Live Site:** https://kiamichibizconnect.com  
**Worker:** kiamichi-biz-connect

## Tech Stack

- **Runtime:** Cloudflare Workers
- **Database:** D1 (SQLite)
- **Storage:** R2 (multiple buckets for different asset types)
- **Cache:** Workers KV
- **AI:** Workers AI (blog generation, content)
- **Frontend:** TailwindCSS, vanilla JS
- **Language:** TypeScript

## Project Structure

```
├── src/
│   ├── index.ts              # Main worker entry
│   ├── routes/               # API route handlers
│   ├── templates/            # HTML templates
│   └── lib/                  # Shared utilities
├── workers/                  # Additional workers (if any)
├── migrations/               # D1 schema migrations
├── schema.sql                # Main database schema
├── seed-components.sql       # Component templates
├── wrangler.toml             # Cloudflare config
├── docs/                     # Architecture docs
└── .github/workflows/        # CI/CD
```

## Do

- Use D1 prepared statements (never raw SQL interpolation)
- Store images in appropriate R2 bucket:
  - `IMAGES` — AI-generated content
  - `BUSINESS_IMAGES` — User uploads
  - `BUSINESS_ASSETS` — Static HTML pages
- Use KV (`CACHE`) for frequently accessed data
- Follow existing route patterns in `src/routes/`
- Use TailwindCSS utility classes
- Return proper HTTP status codes

## Don't

- Don't hardcode database IDs or secrets
- Don't bypass D1 for data storage
- Don't store PII in logs
- Don't add heavy frontend frameworks (keep it light)
- Don't commit `.dev.vars` or real tokens
- Don't use `any` types — define interfaces

## Commands

```bash
# Local development
npm run dev

# Type check
npx tsc --noEmit

# Deploy
npm run deploy
# or
npx wrangler deploy

# D1 Operations
npx wrangler d1 execute kiamichi-biz-connect-db --local --file=./schema.sql
npx wrangler d1 execute kiamichi-biz-connect-db --remote --file=./migrations/v2.sql
npx wrangler d1 execute kiamichi-biz-connect-db --remote --command="SELECT * FROM businesses LIMIT 5"

# R2 Operations
npx wrangler r2 object put kiamichi-biz-images/path/file.jpg --file=./local.jpg
npx wrangler r2 object list kiamichi-biz-images
```

## Safety & Permissions

**Allowed without asking:**
- Read/list files
- Type check
- Local dev server
- D1 SELECT queries

**Ask first:**
- npm install (new dependencies)
- wrangler deploy (production)
- D1 schema changes (migrations)
- R2 bucket operations
- git push
- Modifying business submission flow

## Database Schema

Key tables in D1 (`kiamichi-biz-connect-db`):

- `businesses` — Business listings with contact, hours, description
- `categories` — Service categories (Hair Salons, Home Builders, etc.)
- `cities` — Service area cities
- `reviews` — Customer reviews
- `ads` — Premium ad placements
- `blog_posts` — Business spotlights

See `schema.sql` for full schema.

## R2 Buckets

| Binding | Bucket | Purpose |
|---------|--------|---------|
| `IMAGES` | kiamichi-biz-images | AI-generated images |
| `BUSINESS_IMAGES` | kiamichi-business-images | User uploads |
| `BUSINESS_ASSETS` | kiamichi-business-assets | Static HTML |

## API Conventions

```typescript
// Route pattern
app.get('/api/businesses', async (c) => {
  const db = c.env.DB
  const result = await db.prepare('SELECT * FROM businesses WHERE active = 1').all()
  return c.json(result.results)
})

// Error handling
app.onError((err, c) => {
  console.error('Error:', err.message)
  return c.json({ error: err.message }, 500)
})
```

## Good Examples

- **Route structure:** `src/index.ts`
- **D1 queries:** `src/routes/businesses.ts` (if exists)
- **Template rendering:** `src/templates/`
- **Form handling:** Business submission flow

## Documentation

Existing docs to reference:
- `QUICK_REFERENCE.md` — Common operations
- `WORKER_ARCHITECTURE.md` — System design
- `TESTING_GUIDE.md` — How to test
- `CI_CD_SETUP.md` — GitHub Actions

## When Stuck

- Check existing patterns in `src/`
- Review D1 docs: https://developers.cloudflare.com/d1/
- Ask before modifying core flows (search, submission, payments)
- Don't guess at business logic

## PR Checklist

- [ ] TypeScript compiles (`npm run build`)
- [ ] No hardcoded secrets
- [ ] D1 migrations are versioned (`migrations/vN.sql`)
- [ ] Tested locally with `npm run dev`
- [ ] Small, focused diff
- [ ] Brief summary of changes
