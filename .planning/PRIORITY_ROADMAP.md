# Priority Roadmap

**Analysis Date:** 2026-08-25

This roadmap orders the concerns from `CONCERNS.md` so the most impactful, safest wins come first. Each item includes the safe way to land it without destabilizing other workers or production flows.

## How to Avoid Side Effects

1. **Use feature flags for anything new.** Add the Flagship binding first, then wrap new/unstable behavior in `env.FLAGS.getBooleanValue("...", false)` checks. This lets you deploy code in an off state and enable it only for test traffic.
2. **Keep PRs small and vertical.** One PR per concern (e.g., one PR for the Facebook base64 fix, one PR for the analyzer SQL injection fix). Do not merge mega-branches.
3. **Reconcile schema before adding tables.** Make `schema.sql` the single source of truth, then generate one numbered migration file for each new set of tables. Run the migration in CI before worker deploys.
4. **Add contract tests around shared surfaces.** Any change to `DatabaseService`, business table shape, or R2 key conventions should be covered by a test that both main worker and business-agent rely on.
5. **Deploy behind environments.** Use Wrangler `[env.preview]` / `[env.staging]` blocks where possible, or preview deploys from PRs, before promoting to production.
6. **Clean branches after merge.** Delete or archive branches that have been superseded to prevent accidental revivals.

---

## P0 — Production Safety (Do First)

| # | Concern | Why First | Files | Safe Approach | Dependencies |
|---|---------|-----------|-------|---------------|------------|
| 1 | **Add Flagship binding** ✅ complete | Gates every other change; prevents risky deployments. | `wrangler.toml`, `src/types.ts` | Shipped to production on 2026-08-25. `env.FLAGS` now resolves to Flagship app `ccdbbf6c-2b94-45b9-b5d5-e0c3d9c3fc5a`. | Done. |
| 2 | **Fix analyzer SQL injection** | Could corrupt business data during auto-updates. | `workers/analyzer-worker/src/database.ts` | Replace dynamic `SET ${field}` with a whitelisted map of column names. Add unit test. | None. |
| 3 | **Fix browser-session `cookies` ReferenceError** | Crashes Facebook worker on browser fallback. | `workers/facebook-worker/src/browser-session.ts` | Move `const cookies = await page.cookies()` before its use, or guard safely. | None. |
| 4 | **Fix Facebook content generator use-before-define** | Broken mascot image generation path. | `src/facebook-content-generator.ts` | Consolidate mascot/normal image prompt logic; move variable declaration earlier. | None. |
| 5 | **Fix search result description key bug** | AI search cards show `undefined` descriptions. | `src/index.ts` | Map `description: business.description` in `aiBusinessLinks`. | None. |
| 6 | **Secure unauthenticated facebook-worker endpoints** | `/trigger-queue` and `/api/facebook/auto-post` can be triggered by anyone. | `workers/facebook-worker/src/index.ts` | Check `X-Admin-Key` or require service-binding-only origin. | Decide whether business-agent calls should pass a secret. |

## P1 — CI/CD and Schema Integrity

| # | Concern | Why | Files | Safe Approach | Dependencies |
|---|---------|-----|-------|---------------|------------|
| 7 | **Reconcile `schema.sql` with runtime tables** | A fresh D1 database would fail immediately. | `schema.sql`, all `migrations/*.sql`, standalone migration files | Add every runtime table to `schema.sql`; rename standalone files to `migrations/NNN_*.sql`; add CI step that runs `schema.sql` against a local D1. | None. |
| 8 | **Make CI failures blocking** | Current CI allows `continue-on-error` and `|| echo` fallbacks. | `.github/workflows/ci.yml` | Remove fallbacks for typecheck, build, and test; keep `security` audit as informational if desired. | None. |
| 9 | **Add tests for main worker** | No automated coverage for public routes or admin handlers. | `src/index.ts`, `src/admin.ts`, `src/database.ts` | Add Vitest + `@cloudflare/vitest-pool-workers` and write a few smoke tests for homepage, business page, and admin JSON actions. | None. |
| 10 | **Add tests for analyzer and facebook workers** | Bugs only surface in production. | `workers/analyzer-worker/src/*`, `workers/facebook-worker/src/*` | Add minimal unit tests for analyzer scoring, auto-update logic, and Facebook Graph API wrapper error handling. | None. |
| 11 | **Delete duplicate `.js` files in business-agent** | Build/source confusion. | `workers/business-agent/src/**/*.js` | Audit which `.js` files are generated, add them to `.gitignore`, delete committed copies. | None. |
| 12 | **Declare `zod` explicitly in business-agent** | Reliance on transitive dependency is fragile. | `workers/business-agent/package.json` | Add `zod` to `dependencies`. | None. |

## P2 — Merge Outstanding Code Safely

| # | Concern | Why | Files | Safe Approach | Dependencies |
|---|---------|-----|-------|---------------|------------|
| 13 | **Land Facebook base64 / schedule fixes** | Multiple partially-overlapping branches exist. | `workers/business-agent/src/tools/facebooktools.ts`, `src/facebook-schedule-fix.ts`, etc. | Pick the cleanest branch (`feature/business-listing-editor` or a squashed patch from `facebook-automation-fix`), rebase onto `main`, add Flagship gate if risky, merge. Then delete the other stale branches. | P0 Flagship, P1 CI tests. |
| 14 | **Land about/advertise/pricing + ad-placeholder rendering** | Pages are restored in `cleo/kbc-sponsored-auctions` and `facebook-automation-fix`. | `src/templates.ts`, `src/index.ts` | Take the minimal `cleo/kbc-sponsored-auctions` diff (no mega-branch), merge, and delete `facebook-automation-fix` landing-page portions. | P0 Flagship. |
| 15 | **Commit and PR sponsored-auctions worktree** | Most complete auction code is uncommitted in `.worktrees/admin-displayandbusiness-display`. | `src/auction.ts`, `src/auction-service.ts`, `src/square-auctions.ts`, `migrations/010_sponsored_auctions.sql` | Stage all changes in the worktree, type-check, add tests, apply migration, configure Square secrets, open a single focused PR. After merge, delete `cleo/kbc-sponsored-auctions` branch. | P0 Flagship, P1 schema reconciliation. |
| 16 | **Wire business-agent published pages into main site** | Owners publish to R2 but the public site ignores it. | `src/index.ts` (`handleBusinessPage`), `workers/business-agent/src/routes/api.ts` | In `handleBusinessPage`, check `BUSINESS_ASSETS` first; if a published page exists and is newer than D1 `updated_at`, serve it; otherwise fall back to current D1 renderer. Gate with Flagship. | P0 Flagship. |
| 17 | **Fix VIP publishing in Facebook worker** | VIP posts generate content but never publish. | `workers/facebook-worker/src/vip-posts.ts` | Replace the TODO stub with a call to `officialPostToPage`. Keep under a Flagship flag until tested. | P0 Flagship, P1 tests. |

## P3 — Feature Completion

| # | Concern | Why | Files | Safe Approach | Dependencies |
|---|---------|-----|-------|---------------|------------|
| 18 | **Implement lead email/SMS delivery** | Leads are stored but businesses are never notified. | `src/admin.ts` (`forwardLead`), `src/index.ts` | Integrate Cloudflare Email Service or an email provider via a new `src/email.ts` service. Only enable for businesses with `lead_subscriptions`. | Cloudflare Email / external provider credentials; P0 Flagship. |
| 19 | **Render real ad placements** | `getActiveAdPlacements` exists but pages show placeholder boxes. | `src/templates.ts`, `src/index.ts` | Replace placeholder HTML with a call to `db.getActiveAdPlacements(...)` and render the returned businesses. Gate with Flagship. | P0 Flagship. |
| 20 | **Implement business claim workflow** | Worktree has `business_claim_requests` but no UI. | `src/index.ts`, `src/admin.ts`, `src/auction-service.ts` | Finalize the claim API, add admin approval UI, send email confirmation. | P15 sponsored auctions merged. |
| 21 | **Finish voice agent** | Voice UI exists but uses mocked transcript/response. | `workers/business-agent/src/voice-agent.ts`, `workers/business-agent/src/app.tsx` | Integrate a real STT/TTS provider (e.g., Deepgram, Workers AI Whisper, or OpenAI). Hide behind Flagship until reliable. | P0 Flagship; provider credentials. |
| 22 | **Implement real MCP disconnect** | Currently a stub. | `workers/business-agent/src/mcp-handlers.ts` | Complete the disconnect logic and add a test. | None. |

## P4 — Cleanup and Strategic Work

| # | Concern | Why | Files | Safe Approach | Dependencies |
|---|---------|-----|-------|---------------|------------|
| 23 | **Split or archive `facebook-automation-fix`** | It mixes Sentry, Bigfoot assets, notifications, and Facebook fixes. | Entire `facebook-automation-fix` branch | After removing landing-page and Facebook fixes that were merged separately, decide if Sentry/notifications/Bigfoot assets are wanted. If yes, split into focused branches. | P13-P15 landing. |
| 24 | **Decide on email extraction/marketing worker** | Implemented but unmerged and unintegrated. | `scripts/email-extractor/`, `workers/email-marketing/` | Rebase onto `main`, remove hardcoded hosts/paths, integrate D1 schema, run end-to-end test in preview. | P7 schema reconciliation. |
| 25 | **Move hardcoded IDs/vars to environment-specific config** | Easier preview/staging setup. | `wrangler.toml`, `workers/*/wrangler.*` | Move Facebook page/group IDs, Google client ID, database ID into environment vars or `[env.*]` blocks; keep defaults for production only. | None. |
| 26 | **Refactor `src/index.ts` into route modules** | Long-term maintainability. | `src/index.ts` | Gradually extract route groups into `src/routes/public.ts`, `src/routes/admin.ts`, `src/routes/api.ts`. Each extraction is a small PR with parity tests. | P9 main-worker tests. |
| 27 | **Add rate limiting / bot protection** | Reduce spam on public forms. | `src/index.ts` (`/submit`, `/api/lead`) | Add Cloudflare Turnstile or KV-backed rate limiting. | P0 Flagship. |

---

## Suggested First 5 Commits

1. **Flagship binding** (`wrangler.toml` + `src/types.ts`) — ✅ completed on 2026-08-25.
2. **Analyzer SQL injection fix** — protects data integrity.
3. **Facebook browser-session ReferenceError fix** — prevents worker crashes.
4. **Reconcile `schema.sql`** — makes local/preview environments deterministic.
5. **Make CI tests blocking** — catches regressions from the start.

These five changes are low-risk, high-impact, and do not depend on resolving branch divergence.

---

*Priority roadmap: 2026-08-25*
