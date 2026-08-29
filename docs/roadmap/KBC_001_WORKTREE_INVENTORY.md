# KBC-001 Worktree and Dirty-Change Inventory

Observed: 2026-08-29
Repository: `mintedmaterial/kiamichi-Biz-Connect`
Authoritative baseline: `origin/main` at `9f523bf7648c8d70ddf4deb02a535f8fff78b284`

This inventory is read-only evidence for extracting the current mixed work into bounded issues. Nothing listed here is approval to merge a dirty worktree wholesale.

## Baseline findings

- The canonical checkout `C:/Users/Minte/Desktop/dev-code/kiamichi-biz-connect` is on local `main` at `8463b83681f7e4e9d36e8b651f1d9abcd40b7af9`, eight commits behind `origin/main`, with unrelated modified and untracked files. It must not be reset, cleaned, stashed, or used as an implementation base.
- `origin/main` already contains PRs #15 through #18, including the sponsored-auction hardening and Square sandbox acceptance commits. The current fixed-price product decision supersedes the auction product contract; merged auction code must be removed or converted through KBC-301 and later slices, not silently retained as product truth.
- New work starts from `origin/main` in dedicated sibling worktrees. The original dirty checkouts remain recovery evidence until their changes have been extracted or explicitly discarded.

## Linked worktrees

| Worktree | Branch / HEAD | Status | Disposition |
| --- | --- | --- | --- |
| `kiamichi-biz-connect` | `main` / `8463b83681f7` | Dirty; 8 commits behind | Preserve. Extract roadmap/profile/discovery/browser changes by issue. Do not fast-forward until clean. |
| `.worktrees/admin-displayandbusiness-display` | `admin/displayandBusiness/display` / `53991e0e0e62` | Dirty; 21 commits behind | Preserve as mixed prototype evidence. Never merge wholesale. |
| `kiamichi-biz-connect-auction` | `cleo/kbc-sponsored-auctions` / `2e4c1908be6f` | Only tracked OpenCode DB noise; branch merged | Remove worktree only after OpenCode DB recovery is confirmed unnecessary. |
| `kiamichi-biz-connect-auction-production-ready` | `cleo/auction-production-ready` / `0f7e52687fde` | Clean; branch merged by PR #15 | Safe removal candidate after this inventory PR merges. |
| `kiamichi-biz-connect-deploy-fix` | `cleo/fix-production-deploy-node22` / `cbc40c1b46a0` | Clean; branch merged by PR #16 | Safe removal candidate. |
| `kiamichi-biz-connect-fixed-price-takeovers` | `cleo/fixed-price-sponsored-takeovers` / `9f523bf7648c` | Dirty prototype based on current `origin/main` | Preserve and extract only into KBC-301 through KBC-305. |
| `kiamichi-biz-connect-sandbox-discovery` | `cleo/sandbox-auction-discovery` / `45426efaf2ae` | Clean; branch merged by PR #18 | Safe removal candidate. |
| `kiamichi-biz-connect-secret-deploy-fix` | `cleo/fix-versioned-secret-deploy` / `625c1b220fc3` | Clean; branch merged by PR #17 | Safe removal candidate. |
| `kiamichi-biz-connect-kbc-001` | `cleo/kbc-001-roadmap-intake` / `9f523bf7648c` | Clean baseline before this document | Active KBC-001 documentation/issue branch. |

## Canonical checkout change ownership

| Path | State | Owner issue / disposition |
| --- | --- | --- |
| `.opencode/opencode.db` | modified generated/runtime database | Tool state; never copy into a feature PR. Decide retention before removing merged worktree. |
| `.opencode/opencode.db-shm` | deleted generated SQLite sidecar | Tool state; never copy into a feature PR. |
| `.opencode/opencode.db-wal` | deleted generated SQLite sidecar | Tool state; never copy into a feature PR. |
| `.planning/PRIORITY_ROADMAP.md` | modified | KBC roadmap map issue; copy to KBC-001 branch. |
| `.planning/DISCOVERY_PIPELINE.md` | untracked | KBC-601 through KBC-603; copy only with discovery plan evidence. |
| `docs/11-bigfoot-kbc-agent.md` | modified | KBC-501 project-local agent profiles. |
| `agents/README.md` | untracked | KBC-501. |
| `agents/bigfoot/IDENTITY.md` | untracked | KBC-501. |
| `agents/bigfoot/SOUL.md` | untracked | KBC-501. |
| `agents/bigfoot/TOOLS.md` | untracked | KBC-501. |
| `agents/business-agent/IDENTITY.md` | untracked | KBC-501. |
| `agents/business-agent/SOUL.md` | untracked | KBC-501. |
| `agents/business-agent/TOOLS.md` | untracked | KBC-501. |
| `package.json` | modified with discovery/verifier deploy scripts | KBC-601. |
| `schema.sql` | modified with `discovery_log` | KBC-002 owns canonical schema reconciliation; KBC-601 owns discovery schema behavior. Do not copy without both contracts. |
| `workers/discovery-worker/**` | untracked source/config/package | KBC-601. |
| `workers/verifier-agent/**` | untracked source/config/package plus generated `verifier-upload.js` | KBC-601; generated upload output must be excluded unless build policy explicitly requires it. |
| `workers/facebook-worker/src/browser-session.ts` | modified cookie-order bug fix | Separate focused social/browser reliability issue; do not combine with KBC-401 through KBC-406 quality work. |
| `apple-developer-merchantid-domain-association` | untracked domain-association file | Separate platform/domain verification issue or explicit discard after ownership is verified. |
| `.worktrees/` | untracked linked-worktree directory | Git workspace metadata/container; never commit as product source. |

## `admin/displayandBusiness/display` change ownership

| Paths | State | Owner issue / disposition |
| --- | --- | --- |
| `migrations/010_sponsored_auctions.sql`, `src/auction-service.ts`, `src/auction.ts`, `src/__tests__/auction.test.ts`, `docs/SPONSORED_PLACEMENT_RUNBOOK.md`, `src/square-auctions.ts` | staged/untracked auction implementation | Conflicts with fixed-price requirement. Preserve as evidence; archive or convert only under KBC-301/KBC-302. Never merge as-is. |
| `src/admin.ts`, gallery portions of `src/index.ts`, `src/database.ts`, `src/templates.ts`, `src/types.ts`, `docs/KBC_R2_ASSET_LAYOUT.md`, related `wrangler.toml` bindings | unstaged mixed gallery/R2 implementation | Extract through KBC-201 and KBC-202 after schema contract. |
| `workers/business-agent/env.d.ts`, `src/client.tsx`, `BusinessSelector.tsx`, `PreviewPane.tsx`, `server.ts`, `component-renderer.ts`, `wrangler.jsonc` | staged Business Agent selection/preview/R2 changes | Extract through KBC-104 and KBC-203. Rebase onto current main and verify tenant authorization. |
| `src/facebook-scheduler.ts`, `workers/facebook-worker/src/vip-posts.ts` | staged social scheduling/content changes | Extract only through KBC-401 through KBC-406 with human approval and duplicate-quality gates. |
| Remaining mixed changes in `src/index.ts`, `src/templates.ts`, `src/database.ts`, `wrangler.toml` | unstaged cross-feature edits | Split by symbol and acceptance test; no file-level bulk copy. |

## Fixed-price prototype change ownership

The dirty `cleo/fixed-price-sponsored-takeovers` worktree contains:

- `docs/fixed-price-sponsored-placements.md`
- `migrations/011_fixed_price_sponsored_placements.sql`
- `src/sponsored-placements.ts`
- changes in `src/database.ts`, `src/index.ts`, `src/templates.ts`, and `wrangler.toml`

These 622 added/changed lines are prototype input for KBC-301 through KBC-305. The staged and unstaged layers must be reviewed together; neither layer is a complete release. No code is accepted until the fixed-price product contract, idempotent paid-order state machine, creative approval, active-placement rendering, and expiry reconciliation are independently tested.

## Extraction order

1. Land this inventory and the versioned roadmap/profile documentation without product behavior changes.
2. Complete KBC-002 and KBC-003 from current `origin/main` before feature extraction.
3. Build KBC-101 through KBC-104 from current main; use dirty renderer/UI work only as reference.
4. Extract gallery work through KBC-201 through KBC-204.
5. Replace the now-merged auction contract through KBC-301 through KBC-305.
6. Extract social quality work through KBC-401 through KBC-406.
7. Continue agent platform and discovery slices only after their prerequisite runtime and authorization gates.

## Cleanup gate

A stale worktree may be removed only when:

- its branch is confirmed merged or its unique dirty changes are copied into a named issue/worktree;
- `git status --short` is recorded immediately before removal;
- generated OpenCode state is not the only unrecovered copy of an active session; and
- removal does not delete uncommitted product evidence.
