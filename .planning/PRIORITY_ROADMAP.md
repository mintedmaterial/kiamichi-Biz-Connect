# Kiamichi Biz Connect Priority Roadmap

**Revised:** 2026-08-29
**Purpose:** Break the listing, paid-placement, social, and agent work into small production-safe releases. Every numbered slice is intended to be a separate issue, branch, PR, preview verification, production release, and production readback.

## Destination

KBC has one coherent business lifecycle:

1. a business is discovered or submitted and reviewed;
2. an owner/admin selects one of four supported listing templates;
3. authorized users edit content and media in the Business Agent;
4. all edits render in an isolated preview before approval;
5. approved listing or ad content is published to the public site;
6. paid placement activates and expires from authoritative payment/entitlement state;
7. Bigfoot creates business-specific blog and social drafts from verified D1/R2 evidence;
8. external publication remains behind a human approval gate;
9. `/agents`, `/deployments`, and `/edits` show real tenant-scoped data rather than mock cards.

## Non-negotiable release contract

Apply this contract to every slice below.

1. **One concern per PR.** Do not merge the current mixed worktree or revive a mega-branch.
2. **Exact-head evidence.** Record branch, PR, head SHA, preview URL, Worker name/version, migration tag, and feature flag.
3. **Preview first.** Exercise the real authenticated flow on desktop and a narrow mobile viewport before production approval.
4. **Approval before mutation.** Listing publication, ad publication, blog publication, social publication, email, and payment-affecting actions require an explicit authorized approval.
5. **Production readback.** After deployment, read back the deployed Worker version and bindings, then repeat the smallest live smoke test. A successful build or deploy command is not production proof.
6. **Rollback ready.** Every issue names its feature flag and rollback path. Schema changes must be additive until the old reader is retired.
7. **No user code in an app Worker isolate.** Untrusted user/template code executes in a credential-free per-user Sandbox/Container. The sandbox never receives D1, R2, Square, Facebook, GitHub, or Cloudflare credentials.
8. **Tenant isolation.** Every Business Agent, edit, deployment, media, preview, and custom-agent query is scoped by authenticated owner and business ID on the server.
9. **No silent AI publication.** AI output is a draft with provenance, model, prompt version, input asset IDs, and approval state.
10. **Fixed-price placement contract.** KBC paid takeovers are fixed-price, one-hour guaranteed placements. The unmerged sponsored-auction implementation conflicts with this product rule and must not ship as-is.

## What the repository already contains

| Surface | Current evidence | Status |
| --- | --- | --- |
| Public listing page | One hard-coded renderer in `src/index.ts`; published R2 HTML is checked first in the dirty worktree | Partial |
| Four listing templates | No four-template registry or persisted template selection was found | Absent |
| Admin gallery upload | Multi-image R2 upload exists in the dirty worktree in `src/admin.ts` | Partial, unverified |
| Public gallery | R2 prefix carousel exists in the dirty worktree in `src/index.ts` | Partial, unverified |
| Business Agent page components | `listing_pages`, `page_components`, snapshots, preview, R2 publish tools exist | Partial |
| Ad lookup/rendering | Time-bounded `getActiveAdPlacements()` is called by the homepage | Partial |
| Post-payment editor | Current unmerged Square path activates a placement from the webhook; no paid creative-draft editor handoff exists | Absent |
| Featured expiry | Reads filter expired placements, but `businesses.is_featured` is separately mutated and can drift | Unsafe/partial |
| Social copy/image generation | AI copy, reference-image lookup, Flux generation, and mascot prompting exist; screenshots prove generic repeated output is still publishing | Partial and failing quality bar |
| AI Search tool | Business Agent already has a `RAG_AGENT` service binding; supplied MCP and chat endpoints answer preflight | Partial, runtime contract unverified |
| `/agents` | Hard-coded Business Chat and Voice Agent cards/counts | Mock |
| `/deployments` | Hard-coded listing and landing-page cards/timestamps | Mock |
| `/edits` | Explicit `mockEdits` array | Mock |
| Bigfoot identity | Operational cron prompt doc exists, but no project-local runtime profile bundle existed before this revision | Partial |
| Business Agent identity | Runtime prompt calls the agent “Chi” and grants broad cross-business language; no least-privilege project profile bundle existed before this revision | Unsafe/partial |

## Phase 0 — Establish a safe baseline

### KBC-001 — Split and inventory the dirty work

**Goal:** Produce an exact inventory of the current main checkout, linked worktree, staged files, untracked files, and stale branches. Map every change to one roadmap issue.

**Scope**
- No code behavior changes.
- Preserve the current worktree before extraction.
- Mark generated files and duplicated `.js` output separately from source.

**Acceptance**
- Every changed file has an owner issue or is explicitly discarded.
- Gallery, R2 publishing, auction/Square, Facebook, and UI changes are not combined in one PR.
- Main and each new branch have clean, recoverable status.

### KBC-002 — Make build, schema, and smoke checks authoritative

**Goal:** Stop feature work from passing on a business-agent-only build or a non-blocking CI step.

**Scope**
- Reconcile `schema.sql` with numbered migrations and Business Agent tables.
- Add local clean-database migration test.
- Add main Worker route smoke tests for homepage and one listing.
- Keep business-agent build/type/tests separate but required.
- Remove `continue-on-error`/masked failures from required checks.

**Acceptance**
- Fresh local D1 can be created from the canonical schema/migrations.
- Required CI reports a real failing exit code.
- `npm run build`, main Worker checks, and business-agent checks are independently visible.

### KBC-003 — Verify the live deployment graph

**Goal:** Record what is actually deployed before new feature work.

**Scope**
- Main Worker, Business Agent, Facebook Worker, Analyzer, discovery/verifier Workers.
- Routes, service bindings, D1, R2, KV, AI, Durable Objects, Workflows, Queues, crons, and secret names only.
- Verify whether `RAG_AGENT` points to the same AI Search project as the supplied MCP/chat URLs.

**Acceptance**
- Runtime inventory distinguishes configured, deployed, unavailable, and unverified.
- No secret values are recorded.
- Each later issue references this graph rather than old topology notes.

## Phase 1 — Listing templates and responsive listing flow

### KBC-101 — Persist a template contract without changing the default UI

**Goal:** Add a versioned four-template registry while keeping all existing listings on a `classic` parity template.

**Proposed keys**
1. `classic` — balanced directory profile;
2. `services` — service/contractor CTA-first layout;
3. `showcase` — image/gallery-first retail, venue, restaurant, or property layout;
4. `trust` — reviews, credentials, FAQ, and contact-first professional-services layout.

**Data contract**
- Add `listing_pages.template_key` or an equivalent additive field.
- Validate against a server-owned allowlist; do not execute stored arbitrary template code.
- Store template version used by each preview/publication.

**Acceptance**
- Existing listings render byte/structure-equivalent default content.
- Invalid template keys fail closed to `classic` and emit structured diagnostics.
- Migration and rollback are tested.

### KBC-102 — Ship the four responsive renderers

**Goal:** Make all four templates production-ready before allowing selection.

**Scope**
- Shared typed business view model.
- Semantic heading order, contact CTAs, map fallback, claim/contact forms, gallery slot, and structured metadata.
- Responsive behavior at 360/390px, tablet, and desktop.
- Reduced-motion, keyboard navigation, alt text, contrast, and overflow checks.

**Acceptance**
- Golden fixture renders for the four supplied listings and for missing-image/missing-description cases.
- No horizontal scroll at 360px.
- Primary phone/contact action remains visible and usable on mobile.
- All four templates preserve claim and lead functionality.
- Visual snapshots and real browser screenshots are attached to the PR.

### KBC-103 — Add admin template selection and preview

**Goal:** Let an admin choose a template without immediately changing production.

**Flow**
`select template → create draft → preview exact business → approve → publish → audit record`

**Acceptance**
- Admin can preview all four templates with the target business’s real authorized D1/R2 data.
- Selection alone does not publish.
- Approval records actor, business, old/new template, version, timestamp, and head/deployment context.
- Production smoke covers one template change and rollback to `classic`.

### KBC-104 — Add Business Agent template selection and R2 publication

**Goal:** Give an authorized owner the same draft/preview/approval flow in `app.kiamichibizconnect.com`.

**Scope**
- Server verifies owner-to-business scope; client business selection is not trusted.
- Preview uses the same renderer that creates the published R2 artifact.
- Main site serves only an approved artifact associated with that business and current publication record.

**Acceptance**
- Owner cannot read or mutate another business by changing IDs or slugs.
- Draft edits appear in preview, not production.
- Approved publication appears on the public URL and records an immutable snapshot/hash.
- Failed publish leaves the prior production artifact live.

## Phase 2 — Premium/featured R2 media gallery

### KBC-201 — Replace raw R2 prefix listing with a media manifest

**Goal:** Make gallery membership, order, captions, provenance, approval, and lifecycle authoritative in D1.

**Proposed record fields**
- business ID, R2 key, content type, size, dimensions;
- source type/source URL/rights note;
- caption, alt text, sort order;
- status (`uploaded`, `processing`, `pending_review`, `approved`, `rejected`, `deleted`);
- uploader/agent, timestamps, checksum.

**Acceptance**
- Public pages render only approved media for the authorized business.
- Deleting or reordering media updates the manifest and public gallery deterministically.
- R2 keys are namespaced and never used as authorization.
- Existing worktree upload/carousel code is extracted into this issue rather than bulk-merged.

### KBC-202 — Complete admin gallery management

**Goal:** Upload, inspect, caption, reorder, approve, and remove gallery items from admin.

**Acceptance**
- Type, size, file count, decode, and ownership checks are server-side.
- Admin sees processing/error state per image.
- Mobile and desktop public gallery are exercised after approval.
- Removing media has a recoverable/tombstoned audit record.

### KBC-203 — Complete Business Agent gallery management

**Goal:** Let entitled owners propose gallery changes through chat or listing UI.

**Acceptance**
- Premium/featured entitlement is checked server-side for every write and publish.
- Agent tool calls create pending edits and never bypass preview/approval.
- `/edits` shows upload, reorder, caption, approval, rejection, and publication events from real records.

### KBC-204 — Add sourced-image intake for featured businesses

**Goal:** Allow Bigfoot/analyzer to suggest source images without publishing uncertain or unlicensed media.

**Acceptance**
- Every candidate preserves source URL, observed time, source/rights uncertainty, and business match evidence.
- Candidates remain `pending_review` until an admin approves them.
- No hotlinked social image is treated as a durable owned asset.

## Phase 3 — Fixed-price ad purchase, creative approval, and featured expiry

### KBC-301 — Replace the auction contract with fixed-price one-hour products

**Goal:** Lock the product and data model before touching payment behavior.

**Decision**
- KBC uses fixed-price, one-hour guaranteed paid takeovers—not auctions.
- Do not ship `sponsored_auction_*`, “current bid,” “outbid,” or auction UI from the dirty worktree.

**Scope**
- Define product IDs, placement types, price cents, duration, inventory collision policy, cancellation/refund policy, and timezone display.
- Keep money in integer cents.

**Acceptance**
- Pricing UI, checkout metadata, webhook code, tests, and copy use the same product IDs and amounts.
- The old auction implementation is either archived for reference or converted in a dedicated reviewed PR; it is not partially merged.

### KBC-302 — Create an idempotent paid-order state machine

**Goal:** A successful Square payment creates a paid order and reserved slot, not a live ad.

**State model**
`checkout_created → payment_pending → paid_needs_creative → creative_pending_approval → scheduled → live → expired`

Failure states include `payment_failed`, `payment_mismatch`, `approval_rejected`, `cancelled`, and `refund_pending/refunded` as supported.

**Acceptance**
- Webhook signature is mandatory in production.
- Duplicate/out-of-order events are idempotent.
- Amount, currency, location, order metadata, business, and product are verified.
- Redirect lands on an authenticated order editor; query string `paid=1` is never proof of payment.
- Payment success does not set `is_featured` or publish an ad.

### KBC-303 — Build the post-payment creative editor and exact preview

**Goal:** Let the purchaser attach images and edit copy/offer/CTA before approval.

**Acceptance**
- Editor loads only orders owned by the authenticated user/business.
- Image and text validation is server-side.
- Preview is the same component used by the production placement.
- Autosave is versioned; approval targets an exact creative version.
- User can submit, revise after rejection, and explicitly approve final creative.

### KBC-304 — Publish approved ads and show them in Featured Businesses

**Goal:** Activate the approved creative only for its paid reservation window.

**Acceptance**
- Homepage featured cards use active placement/creative records, not manually toggled `businesses.is_featured` alone.
- Paid image, offer, CTA, disclosure, start, and end render correctly on mobile and desktop.
- Collision behavior matches the product contract.
- Production test uses Square sandbox through payment, editor, approval, scheduled activation, and public rendering before a controlled live purchase is approved.

### KBC-305 — Expire placements and reconcile featured state

**Goal:** Remove expired ads without leaving stale featured businesses.

**Acceptance**
- Reads exclude expired records immediately.
- A scheduled idempotent reconciler marks lifecycle state and clears any compatibility flag only when no other active entitlement exists.
- Manual/editorial featured status is modeled separately from paid placement.
- Tests cover overlapping placements, retries, delayed cron, cancellation, and clock boundaries.

## Phase 4 — Business-specific social and blog production

### KBC-401 — Build a grounded business context packet

**Goal:** Give the generator verified evidence instead of only name/city/generic description.

**Packet includes**
- current business fields, categories, approved gallery assets, approved social images;
- ratings/review counts with source and observed time;
- website/Facebook URLs and extracted facts with provenance;
- recent KBC posts for the business and semantic/template similarity hashes;
- explicit missing/uncertain fields.

**Acceptance**
- No invented services, people, credentials, offers, ratings, or interiors.
- Prompt input and chosen assets are auditable by ID.
- Context gathering has limits, timeouts, cache behavior, and a non-publishing failure state.

### KBC-402 — Add copy variation and quality gates

**Goal:** Prevent screenshots like the current repeated “Take a look at…” posts.

**Acceptance**
- Reject exact duplicates and near-duplicates against a recent-post window.
- Reject banned generic openings and fallback copy from automatic publication.
- Require at least two business-specific grounded details when evidence allows.
- Record model, prompt version, temperature, context hash, output hash, and quality reasons.
- If generation fails quality checks, create `needs_revision`; do not publish the generic fallback.

### KBC-403 — Generate a business-specific base image

**Goal:** Use approved business assets and verified facts to produce a unique visual.

**Acceptance**
- Image selection/generation uses the context packet and approved references.
- No fabricated storefront logo, employee likeness, certification, or service claim.
- Model output is stored as a candidate with provenance and approval state.
- Each featured-business draft has an image candidate or an explicit asset-blocked status.

### KBC-404 — Composite the mascot deterministically

**Goal:** Keep the business visual primary and add the approved Bigfoot mascot as a controlled overlay/HTML slide rather than relying on the image model to redraw it.

**Acceptance**
- Use approved mascot assets with deterministic position/safe areas.
- Generate page/group aspect variants without cropping the business subject or CTA.
- Visual QA checks text legibility, mascot fidelity, logo use, and mobile feed crop.

### KBC-405 — Add a shared humanization policy for social and blog drafts

**Goal:** Apply a versioned KBC writing policy comparable to the humanizer skill without importing a private Hermes skill into the Worker.

**Policy**
- factual grounding first;
- natural sentence rhythm and local voice;
- no fabricated first-person experience;
- no fake testimonials or undisclosed sponsorship;
- no repetitive hooks, emoji spam, corporate filler, or engagement bait;
- platform-appropriate length and disclosure.

**Acceptance**
- Shared policy is used by Facebook, blog, and Bigfoot draft paths.
- Tests cover prohibited phrases, unsupported claims, disclosure, length, and duplicate similarity.
- Humanizer is a draft-quality stage, never a fact-generation stage.

### KBC-406 — Add review, approval, publish, and telemetry

**Goal:** Make external publication deliberate and measurable.

**Acceptance**
- Reviewer sees copy, image, sources, uncertainty, destination, and scheduled time.
- Approval is bound to exact copy/image versions; editing invalidates approval.
- Facebook posting remains human-approved unless Colt authorizes a narrowly scoped exception later.
- Store provider post ID/URL, response classification, attempts, and engagement metrics without logging tokens.

## Phase 5 — Bigfoot and Business Agent platform

### KBC-501 — Adopt project-local agent profile bundles

**Goal:** Keep identity, voice, permissions, and tool contracts versioned with the project.

**Artifacts**
- `agents/bigfoot/IDENTITY.md`, `SOUL.md`, `TOOLS.md`;
- `agents/business-agent/IDENTITY.md`, `SOUL.md`, `TOOLS.md`;
- `agents/README.md` describing runtime injection and authority boundaries.

**Acceptance**
- Runtime system prompts are composed from versioned profile files or a generated artifact, not copied into multiple source files.
- Profile text cannot grant permissions; server-side capability checks remain authoritative.
- Bigfoot is organization-facing KBC operations; Business Agent is tenant/business-scoped.

### KBC-502 — Connect AI Search as a least-privilege Bigfoot tool

**Goal:** Connect the supplied AI Search MCP endpoint to Bigfoot and verify its actual tool contract.

**Scope**
- Prefer Agents SDK MCP client with a stable server ID and environment-configured URL.
- If the deployed `RAG_AGENT` service binding reaches the same Worker, prefer internal binding/RPC for server-to-server calls where supported.
- Keep any authentication header in Worker secrets.

**Acceptance**
- MCP initialize/list-tools smoke test is captured in preview.
- Tools are allowlisted by exact name and classified read-only vs mutating.
- Business/user scope is passed and enforced server-side.
- Timeout/retry/error UI and disconnect use real `removeMcpServer()` behavior.

### KBC-503 — Upgrade Agents SDK before using 2026 APIs

**Goal:** Remove API-version drift before durable fibers, current MCP behavior, or new agent runtime work.

**Evidence**
- Business Agent currently declares `agents@^0.3.0`; current Cloudflare MCP documentation references newer APIs.

**Acceptance**
- Upgrade is a dedicated PR with migration notes, generated types, chat reconnect tests, MCP connect/list/disconnect tests, and production rollback.
- No `@cloudflare/computer`, Sandbox, or Flue package is added in this PR.

### KBC-504 — Add durable agent jobs and approval workflows

**Goal:** Survive Worker/DO eviction during research, draft generation, and publication approval.

**Architecture**
- Agent-internal resumable work: Agents SDK fibers/checkpoints.
- Independent multi-step business process: Cloudflare Workflow.
- Long human wait: workflow approval gate with timeout.

**Acceptance**
- Kill/restart test resumes from a checkpoint without duplicate post, image, or charge.
- Every job has idempotency key, status, attempts, bounded error, and cancellation/timeout behavior.

### KBC-505 — Prove the sandbox architecture before installing runtime packages

**Goal:** Select the minimum execution primitive for each task.

**Decision guide**
- Normal typed product tools and D1/R2 calls: Worker code/service bindings; no sandbox.
- Short generated API-orchestration code: evaluate `@cloudflare/codemode` in a constrained spike.
- Untrusted user code or full Linux/build preview: per-user `@cloudflare/sandbox`/Container with VM isolation.
- Durable virtual workspace spanning isolate/container backends: evaluate `@cloudflare/computer` separately; it is not a substitute for tenant authorization or secret isolation.
- Flue: evaluate only if its declarative harness materially replaces existing Business Agent orchestration; do not add a second harness by default.

**Acceptance**
- Threat model covers filesystem, process, network, CPU/memory/time, SSRF/egress, output size, and cleanup.
- One sandbox per owner/business boundary; sandbox IDs alone are not authorization.
- No production credentials enter the sandbox. A Worker-side broker exposes narrow, authenticated operations if needed.
- Ephemeral state loss and durable artifact promotion are tested.
- Package install requires explicit approval after the spike names exact package/version/config/cost.

### KBC-506 — Make `/agents` real and role-aware

**Goal:** Replace static cards with authorized agent inventory.

**Admin view**
- Bigfoot, Facebook, Analyzer, discovery/verifier, and other KBC-owned Workers/agents with real health/configuration state.

**Business view**
- The business’s editing agent and up to the entitled number of custom agents.

**Acceptance**
- No fake conversation/call counts or “Active” badges.
- Health is based on runtime evidence with last-observed timestamp.
- Admin-only agents never appear to normal business users.

### KBC-507 — Implement bounded custom-agent templates

**Goal:** Let eligible businesses create one or two agents from reviewed templates such as social draft or email-draft assistant.

**Acceptance**
- Template allowlist defines tools, scopes, schedules, limits, and approval requirements.
- Users cannot supply arbitrary system-level instructions, bindings, URLs, or credentials.
- Social/email output is draft-only by default.
- Quotas, delete/export, audit, and tenant isolation are tested.

### KBC-508 — Make `/edits` an authoritative approval ledger

**Goal:** Replace `mockEdits` with immutable listing/media/template/ad change records.

**Acceptance**
- Records include actor, business, change type, before/after snapshot references, status, approval, publication ID, and timestamps.
- Tenant and admin views are scoped correctly.
- Rollback creates a new change; history is never silently rewritten.

### KBC-509 — Make `/deployments` a publication ledger, not a Cloudflare dashboard clone

**Goal:** Show business-visible publications and admin release evidence without exposing provider credentials.

**Business view**
- Listing publications, ad publications, custom-agent deployments, status, URL, version/hash, and rollback target.

**Admin view**
- Adds Worker/version/route/binding evidence and exact GitHub PR/SHA where available.

**Acceptance**
- No hard-coded timestamps, URLs, or status.
- Failed/rolled-back/publication-pending states are visible.
- Changing a listing is an edit; promoting an approved artifact is a deployment/publication. The UI keeps them distinct.

## Phase 6 — Discovery pipeline continuation

The existing `DISCOVERY_PIPELINE.md` Phase 1 remains valid as a review-oriented intake plan, but it is not production-complete until KBC-001 through KBC-003 are done.

### KBC-601 — Verify Phase 1 discovery in preview

**Acceptance**
- Queue/DLQ, Workflows, verifier service binding, migrations, secret names, and disabled-by-default flag are verified.
- One authenticated manual run creates reviewable submissions without auto-publishing.
- Duplicate, out-of-region, low-confidence, source failure, and retry paths are observed.

### KBC-602 — Route approved discovery into media/listing review

**Acceptance**
- Approved candidates create a normal listing draft and optional sourced-media candidates.
- They do not bypass template selection, ownership, provenance, or publication approval.

### KBC-603 — Add discovery admin UI only after runtime proof

**Acceptance**
- Admin can inspect source evidence, verifier result, confidence, duplicate reasoning, and retry state.
- Approval creates an audited listing draft; rejection remains in the discovery ledger.

## Deferred until the core flows are proven

- Automatic Facebook/Instagram publication without human approval.
- Autonomous production deployment by Bigfoot or a business-owned agent.
- Arbitrary user-defined agent tools, MCP URLs, credentials, or system prompts.
- Flue migration of the existing harness.
- Full container for ordinary D1/R2 CRUD or simple model tool calls.
- Phase 2 discovery auto-add.
- Voice-agent expansion.
- Broad `src/index.ts` refactor unrelated to an active vertical slice.

## Recommended execution order

1. KBC-001 → KBC-002 → KBC-003.
2. KBC-101 → KBC-102 → KBC-103 → KBC-104.
3. KBC-201 → KBC-202 → KBC-203 → KBC-204.
4. KBC-301 → KBC-302 → KBC-303 → KBC-304 → KBC-305.
5. KBC-401 → KBC-402 → KBC-403 → KBC-404 → KBC-405 → KBC-406.
6. KBC-501 → KBC-502 → KBC-503 → KBC-504 → KBC-505 → KBC-506 → KBC-508 → KBC-509 → KBC-507.
7. KBC-601 → KBC-602 → KBC-603.

Listing and gallery work may proceed in parallel only after KBC-002/KBC-003, provided they do not touch the same renderer/schema migration. Payment and social publication should remain serialized because both affect paid reputation-facing production state.

## Standard issue acceptance checklist

- [ ] Scope and explicit non-scope
- [ ] Data owner and tenant authorization rule
- [ ] State machine and idempotency key
- [ ] Migration plus rollback/compatibility plan
- [ ] Feature flag default off
- [ ] Unit/contract tests
- [ ] Authenticated end-to-end preview flow
- [ ] Desktop and mobile UI evidence
- [ ] Accessibility and failure-state evidence
- [ ] `pr-checker` real-diff triage
- [ ] Curator runbook/project-map update
- [ ] Deep code review
- [ ] Non-implementing lane verification
- [ ] Cleo production approval
- [ ] Deployed version/bindings readback
- [ ] Live smoke test and rollback target recorded

## Current highest-risk blockers

1. The main checkout and linked worktree contain mixed staged/modified/untracked work.
2. The root build currently targets only the Business Agent, not the full application graph.
3. The dirty Square implementation is an auction and directly activates placement after payment, conflicting with the fixed-price one-hour and post-payment creative-approval requirements.
4. Featured status has multiple authorities (`businesses.is_featured`, ad dates, and Facebook rotation), so expiry can drift.
5. Social generation has sophisticated code but no effective publication quality gate; production screenshots show repeated copy and the same mascot-only asset.
6. `/agents`, `/deployments`, and `/edits` currently present mock data as if it were live.
7. The Business Agent’s broad “ANY business listing” prompt is not a security boundary and must be replaced by enforced owner/business scoping.
8. `agents@^0.3.0` should not be assumed to support current 2026 MCP/fiber APIs without a dedicated upgrade and tests.
