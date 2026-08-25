# Codebase Concerns

**Analysis Date:** 2026-08-25

## Tech Debt

**Schema Drift and Migration Sprawl:**
- Issue: `schema.sql` declares only 7 tables, but the running code depends on many more tables defined in one-off migration files.
- Files: `schema.sql`, `migrations/003_facebook_posts.sql`, `migrations/004_facebook_posting_system.sql`, `migrations/004_featured_rotation.sql`, `migrations/005_business_portal.sql`, `migrations/005_vip_businesses.sql`, `migrations/006_preview_publish_system.sql`, `migrations/0009_social_media_images.sql`, `migration-ai-analyzer.sql`, `migration-oauth.sql`, `lead-generation-schema.sql`, `backend/migrations/*`.
- Impact: A fresh D1 database built from `schema.sql` alone will fail at runtime. Durable Objects classes in `workers/business-agent/wrangler.jsonc` also expect additional tables (`page_snapshots`, `published_pages_r2`) not in `schema.sql`.
- Fix approach: Reconcile all runtime tables into `schema.sql`, convert standalone files into a numbered migration sequence, and add a CI check that validates schema against the code.

**Monolithic Main Worker Router:**
- Issue: `src/index.ts` is a single ~1,600+ line file containing every route, page builder, API handler, and inline HTML. New features are added directly to this file.
- Files: `src/index.ts`.
- Impact: Hard to review, test, and refactor; high risk of merge conflicts; no clear separation between public pages, admin APIs, and utilities.
- Fix approach: Decompose into route modules under a `src/routes/` directory and shared service modules.

**Duplicated/Stale Build Artifacts in Business-Agent:**
- Issue: `workers/business-agent/` contains both `.ts` and `.js` versions of key files (`server.ts`/`server.js`, `routes/api.ts`/`api.js`, etc.), suggesting stale output or failed build cleanups.
- Files: `workers/business-agent/src/`.
- Impact: Risk of editing the wrong file; unpredictable deploy contents.
- Fix approach: Delete `.js` duplicates and add a pre-build clean step; enforce via `.gitignore` if needed.

**Feature-Flag Binding Added, but Not Yet Used in Code:**
- Issue: Cloudflare Flagship is now configured in production (`env.FLAGS`), but no application code evaluates flags yet.
- Files: `src/types.ts`, `wrangler.toml`.
- Impact: The platform is ready for safe rollouts, but feature toggles are not yet protecting risky code paths.
- Fix approach: Wrap upcoming fixes and new behavior with `env.FLAGS.getBooleanValue(...)` starting with Facebook fixes, ad rendering, and published-page serving.

**Parallel Branches Implementing the Same Features:**
- Issue: The same Facebook image base64 fix, CST schedule fix, and `/about` `/advertise` `/pricing` page restoration exist in multiple unmerged branches.
- Branches: `cleo/kbc-sponsored-auctions`, `business-agent-voice-ui`, `facebook-automation-fix`, `feature/business-listing-editor`.
- Impact: Merge conflicts, duplicated testing effort, unclear source of truth.
- Fix approach: Agree on one branch per feature, rebase/merge Facebook fixes first, then landing page fixes, then sponsored auctions.

**Unfinished Sponsored Auctions Worktree:**
- Issue: The most complete sponsored-auction implementation lives only in the untracked `.worktrees/admin-displayandbusiness-display` worktree with staged and unstaged changes. It has not been committed or PR'd.
- Files: `src/auction.ts`, `src/auction-service.ts`, `src/square-auctions.ts`, `migrations/010_sponsored_auctions.sql`.
- Impact: Valuable work is at risk of loss and invisible to CI.
- Fix approach: Commit, type-check, run tests, apply the migration, configure real Square secrets, and open a focused PR.

## Known Bugs

**Facebook Content Generator Use-Before-Define:**
- Symptoms: Possible runtime ReferenceError when `buildEnhancedJSONPrompt` references `includeMascot`.
- Files: `src/facebook-content-generator.ts`.
- Trigger: Generating enhanced business images with mascot logic.
- Workaround: Consolidate mascot and non-mascot generators or move `includeMascot` declaration before its use.

**Facebook Worker Browser Session ReferenceError:**
- Symptoms: Worker crashes during user-id fallback in browser automation.
- Files: `workers/facebook-worker/src/browser-session.ts` (line 266 uses `cookies.find(...)` before `cookies` is declared on line 281).
- Trigger: Browser-session fallback when profile ID is not extracted from the initial page.
- Workaround: Move `cookies` declaration earlier or safely handle the missing array.

**Analyzer Worker SQL Injection in Auto-Apply:**
- Symptoms: Autonomous updates dynamically interpolate `suggestion.field` into an `UPDATE` statement.
- Files: `workers/analyzer-worker/src/database.ts`.
- Trigger: Autonomous cron with high-confidence suggestions.
- Workaround: Whitelist allowed fields or use a parameterized column map instead of string interpolation.

**Search Results Description Key Bug:**
- Symptoms: AI search result cards may show `undefined` for the description.
- Files: `src/index.ts` (search handler pushes `businesses: business.description` instead of `description`).
- Trigger: Natural-language search that returns NLWeb business results.
- Workaround: Change the mapped key to `description`.

**Facebook SDK Config Mismatch:**
- Symptoms: `htmlTemplate` checks `env.FB_APP_ID` and `env.FB_API_VERSION`, but `wrangler.toml` only defines `FACEBOOK_APP_ID` and no API version var.
- Files: `src/templates.ts`, `wrangler.toml`.
- Trigger: Any HTML page load.
- Workaround: Map `FB_APP_ID`/`FB_API_VERSION` in `[vars]` or normalize template references to `FACEBOOK_APP_ID`.

## Security Considerations

**No Rate Limiting or Bot Protection on Forms:**
- Risk: Contact/lead forms and business submission forms can be spammed or scraped without CAPTCHA, Turnstile, or rate limits.
- Files: `src/index.ts` (`/submit`, `/api/lead`), `src/admin.ts`.
- Current mitigation: HTTPS and Cloudflare edge DDoS only.
- Recommendations: Add Cloudflare Turnstile or rate-limiting middleware.

**Hardcoded Identifiers in Wrangler Configs:**
- Risk: `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`, Facebook page/group/profile IDs, D1 database ID, and R2 bucket names are committed. While some are public, others tie the repo to a single account and complicate preview environments.
- Files: `wrangler.toml`, `workers/business-agent/wrangler.jsonc`, `workers/facebook-worker/wrangler.toml`.
- Current mitigation: Secrets are injected via `wrangler secret put`; non-secrets are visible.
- Recommendations: Move environment-specific IDs into environment-specific `[env.*]` blocks or GitHub variables.

**Unauthenticated Facebook-Worker Endpoints:**
- Risk: `/api/facebook/auto-post` and `/trigger-queue` appear to have no authentication check.
- Files: `workers/facebook-worker/src/index.ts`.
- Current mitigation: Obscurity; endpoints not publicly documented.
- Recommendations: Add admin/session token validation or service-binding-only access.

**SQL Injection Risk in Analyzer:**
- Risk: See Known Bugs above; autonomous field updates are interpolated.
- Files: `workers/analyzer-worker/src/database.ts`.
- Current mitigation: Field names are internally generated, but no compile-time or runtime whitelist exists.
- Recommendations: Validate field names against the `Business` interface keys.

**Feature Flags Missing:**
- Risk: Cannot disable Facebook automation, AI search, or new beta features without redeploying.
- Files: `wrangler.toml`, `src/types.ts`.
- Recommendations: Keep the binding as-is and start gating risky/new features before merging larger branches.

## Performance Bottlenecks

**Main Worker Bundle Size:**
- Problem: Main worker bundle is reported at ~1.7 MB.
- Files: `src/index.ts`, `src/templates.ts`.
- Cause: Few shared dependencies pulled into a single entry plus inline HTML/CSS strings.
- Improvement path: Tree-shake unused code, split admin route code behind service bindings, and move large templates to R2 or import-on-demand.

**Business Page Renders Facebook Posts on Every Request:**
- Problem: `handleBusinessPage` queries `facebook_posts` (and potentially the Facebook embeds) without KV or edge caching.
- Files: `src/index.ts` (`renderFacebookPosts`).
- Cause: No cache for this fragment.
- Improvement path: Cache rendered post HTML in KV with a short TTL or pre-render posts to R2.

**Search AI Call Without Timeout:**
- Problem: `handleSearch` fetches the external NLWeb worker without a timeout or abort controller.
- Files: `src/index.ts`.
- Cause: Direct `fetch` with default behavior.
- Improvement path: Add `AbortSignal.timeout(2000)` and degrade gracefully when NLWeb is slow.

## Fragile Areas

**`src/index.ts` (Main Router):**
- Files: `src/index.ts`.
- Why fragile: Every public route, admin API, and page layout lives here. A small typo can break many pages.
- Safe modification: Add new routes at the bottom of the routing block or, better, extract to `src/routes/*.ts`.
- Test coverage: No unit tests for the main worker.

**Facebook GraphQL Posting Shim:**
- Files: `workers/facebook-worker/src/fb-graphql-api.ts`.
- Why fragile: Hardcoded Facebook GraphQL doc IDs, revisions, and hashes will break when Facebook updates its web app.
- Safe modification: Prefer the official Graph API path and keep GraphQL-only as a fallback.
- Test coverage: None.

**Browser Automation in Facebook Worker:**
- Files: `workers/facebook-worker/src/browser-session.ts`.
- Why fragile: Depends on `@cloudflare/puppeteer` Browser Rendering API, login credentials, and Facebook page layout.
- Safe modification: Treat as fallback; monitor failures and fail open to official API posting.
- Test coverage: None.

**Shared D1 Schema Across Four Workers:**
- Files: `wrangler.toml`, `workers/*/wrangler.*`, all `src/*.ts`.
- Why fragile: A schema change in one worker can break another worker at runtime.
- Safe modification: Centralize schema migrations and run them in CI before any worker deploy.
- Test coverage: No shared schema validation test.

## Scaling Limits

**D1 Database Size and Concurrency:**
- Current capacity: 933 KB, <1 ms queries (per `VERIFICATION_REPORT.md`).
- Limit: D1 has query-per-second and storage limits; image generation logs and social post analytics may grow quickly.
- Scaling path: Add pruning jobs for old `facebook_content_queue` rows, `admin_sessions`, and `atlas_activity`; move large blobs to R2.

**Workers AI Concurrency:**
- Current capacity: Used for blog text, images, Facebook content, and analyzer enrichment.
- Limit: Account-level Workers AI rate limits may throttle daily cron if many heavy prompts run simultaneously.
- Scaling path: Queue AI work, add retries with backoff, and use cheaper models for low-value tasks.

## Dependencies at Risk

**`zod` Used Transiently in Business-Agent Tools:**
- Risk: `workers/business-agent/src/tools/*.ts` imports `z` from `zod/v3`, but `zod` is not in `package.json`.
- Impact: If `ai` or another dependency stops bundling `zod`, tools will break.
- Migration plan: Add `zod` explicitly to `workers/business-agent/package.json`.

**Facebook Graph API Version:**
- Risk: Code mixes v17.0, v18.0, and v19.0 endpoints; Facebook deprecates older versions.
- Impact: Token exchange or posting calls may stop working.
- Migration plan: Standardize on the latest supported version and review deprecation calendar.

**Browser Rendering API (Puppeteer):**
- Risk: `@cloudflare/puppeteer` is a beta/availability product.
- Impact: Facebook worker may fail to spawn browser sessions in some regions or accounts.
- Migration plan: Keep official Graph API path as primary; browser automation as optional fallback.

## Missing Critical Features

**Flagship Rollout Usage:**
- Problem: The binding is live in production, but there are still no flag checks in runtime code.
- Blocks: Safe staged rollout of the next fixes.
- Current state:
  ```toml
  # wrangler.toml
  [[flagship]]
  binding = "FLAGS"
  app_id = "ccdbbf6c-2b94-45b9-b5d5-e0c3d9c3fc5a"
  ```
  ```ts
  // src/types.ts
  export interface Env {
    // ...existing bindings
    FLAGS: Flagship;
  }
  ```
- Next step: Add targeted `env.FLAGS.getBooleanValue(...)` checks as each risky change lands.

**Lead Email / SMS Notification Delivery:**
- Problem: Leads are stored but never emailed or texted to businesses.
- Files: `src/admin.ts` (`forwardLead`), `src/index.ts` (`handleSubmitBusiness` leads path).
- Blocks: Real lead workflow for paid subscribers.

**Ad Placement Serving:**
- Problem: `DatabaseService.getActiveAdPlacements` exists, but homepage/category/blog pages show hard-coded "Advertisement" placeholder boxes instead of real ads.
- Files: `src/templates.ts`, `src/index.ts`.
- Blocks: Monetization of sponsored placements.

**Business-Agent Main-Site Integration:**
- Problem: `handleBusinessPage` in `src/index.ts` still renders from D1 and does not check `BUSINESS_ASSETS` for published custom pages.
- Files: `src/index.ts`, `workers/business-agent/src/routes/api.ts`.
- Blocks: Business owners seeing published pages on the public site.

**VIP Business Real Publishing:**
- Problem: `workers/facebook-worker/src/vip-posts.ts` generates VIP content but does not actually publish posts (line is a TODO).
- Files: `workers/facebook-worker/src/vip-posts.ts`.
- Blocks: Paid VIP daily Facebook posts.

**Sponsored Auctions Main-Site Support:**
- Problem: Auction engine, Square webhook, `business_claim_requests`, claim API, and about/advertise/pricing pages are only in `.worktrees/admin-displayandbusiness-display`.
- Files: `src/auction.ts`, `src/square-auctions.ts`, `migrations/010_sponsored_auctions.sql`.
- Blocks: Sponsored-placement monetization and self-serve business claims.

**Email Extraction / Marketing Pipeline:**
- Problem: Implemented in remote `remotes/origin/feat/email-extraction-marketing` but not merged or tied to the main app.
- Files: `scripts/email-extractor/`, `workers/email-marketing/`, `workers/database-enrichment/`.
- Blocks: Automated email marketing campaigns.

## Test Coverage Gaps

**Main Worker Has No Tests:**
- What's not tested: Every route, handler, and database method in `src/index.ts`, `src/admin.ts`, and `src/database.ts`.
- Files: `src/index.ts`, `src/admin.ts`, `src/database.ts`.
- Risk: Regressions in public pages or admin APIs go unnoticed.
- Priority: High.

**Analyzer and Facebook Workers Have No Tests:**
- What's not tested: Analyzer scoring, web tools, Facebook posting, featured rotation, browser session.
- Files: `workers/analyzer-worker/src/*`, `workers/facebook-worker/src/*`.
- Risk: Bugs like the `cookies` ReferenceError are only caught in production.
- Priority: High.

**CI Allows Test Failures:**
- What's not tested: CI uses `|| echo "...completed"` and `continue-on-error: true` in several steps, so failures do not block merges.
- Files: `.github/workflows/ci.yml`.
- Risk: Broken tests are ignored.
- Priority: Medium.

## Worktree / Branch Divergence Summary

| Branch / Worktree | HEAD | State | Key Work |
|-------------------|------|-------|----------|
| `main` | `53991e0` | Production baseline | All merged code currently deployed. |
| `.worktrees/admin-displayandbusiness-display` | `53991e0` + uncommitted changes | **In progress, not PR'd** | Sponsored auctions, Square webhooks, business claim API, about/advertise/pricing pages, admin business image uploads. |
| `cleo/kbc-sponsored-auctions` | `59288ef` | Unmerged (2 commits) | Only restores logo/avatar fallback and about/advertise/pricing pages and ad placeholders. **No auction code.** |
| `business-agent-voice-ui` | `85c1d7e` | Unmerged (6 commits) | Voice UI scaffolding, social-post workflow, Facebook schedule/image fixes, admin override. Voice path is mocked. |
| `facebook-automation-fix` | `9fab14c` | Unmerged | Bigfoot mascot, Sentry, notifications/monitoring, Facebook image/schedule fixes, about/advertise/pricing, large binary assets. |
| `feature/business-listing-editor` | `d55046e` local | Remote merged; local ahead | Facebook chat-agent image fix and social workflow instructions. |
| `remotes/origin/feat/email-extraction-marketing` | `efcdd38` | Unmerged | CSV email extractor, database enrichment worker, email-marketing worker, Changesets workflow. |
| `remotes/origin/feat/bigfoot-mascot-integration` | `2ec45e3` | **Merged into main** | Bigfoot mascot code already in `main`. |

**Immediate recommendations:**
1. Start using the live Flagship binding to gate the next risky change.
2. Land the Facebook base64/schedule fix by choosing one branch (`feature/business-listing-editor` or a clean PR from `facebook-automation-fix`).
3. Commit and PR the sponsored-auctions worktree, then delete/supersede `cleo/kbc-sponsored-auctions`.
4. Rebase `business-agent-voice-ui` onto `main`, strip mock voice code or hide behind a flag, and split into focused PRs.
5. Decide whether `facebook-automation-fix` should be split into mascot-only, notifications-only, and Sentry-only PRs, or abandoned in favor of the worktree + `feature/business-listing-editor`.
6. Add real tests for the main worker and make CI failures blocking.

---

*Concerns audit: 2026-08-25*
