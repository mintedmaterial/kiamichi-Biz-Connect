# KBC Roadmap Issue Index

Delivery map: [Listing, gallery, paid placement, social, and agent delivery program](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/19)

This index maps the versioned roadmap IDs to their bounded GitHub implementation issues. Dependency labels are maintained on GitHub; a blocked issue is not eligible for implementation merely because its worktree can be created.

## Baseline

- [KBC-001: Split and inventory the dirty work](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/20)
- [KBC-002: Make build, schema, and smoke checks authoritative](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/21)
- [KBC-003: Verify the live deployment graph](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/22)

Authoritative runtime baseline: [`docs/KBC-003-deployment-graph-inventory.md`](../KBC-003-deployment-graph-inventory.md). Later slices must refresh this graph when they change a Worker, route, binding, secret name, cron, Queue, Workflow, Durable Object, or storage resource.

## Listing templates

- [KBC-101: Persist a template contract without changing the default UI](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/23)
- [KBC-102: Ship the four responsive renderers](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/24)
- [KBC-103: Add admin template selection and preview](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/25)
- [KBC-104: Add Business Agent template selection and R2 publication](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/26)

## Premium gallery

- [KBC-201: Replace raw R2 prefix listing with a media manifest](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/27)
- [KBC-202: Complete admin gallery management](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/28)
- [KBC-203: Complete Business Agent gallery management](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/29)
- [KBC-204: Add sourced-image intake for featured businesses](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/30)

## Fixed-price paid placement

- [KBC-301: Replace the auction contract with fixed-price one-hour products](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/31)
- [KBC-302: Create an idempotent paid-order state machine](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/32)
- [KBC-303: Build the post-payment creative editor and exact preview](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/33)
- [KBC-304: Publish approved ads and show them in Featured Businesses](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/34)
- [KBC-305: Expire placements and reconcile featured state](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/35)

## Social and blog production

- [KBC-401: Build a grounded business context packet](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/36)
- [KBC-402: Add copy variation and quality gates](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/37)
- [KBC-403: Generate a business-specific base image](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/38)
- [KBC-404: Composite the mascot deterministically](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/39)
- [KBC-405: Add a shared humanization policy for social and blog drafts](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/40)
- [KBC-406: Add review, approval, publish, and telemetry](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/41)

## Bigfoot and Business Agent

- [KBC-501: Adopt project-local agent profile bundles](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/42)
- [KBC-502: Connect AI Search as a least-privilege Bigfoot tool](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/43)
- [KBC-503: Upgrade Agents SDK before using 2026 APIs](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/44)
- [KBC-504: Add durable agent jobs and approval workflows](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/45)
- [KBC-505: Prove the sandbox architecture before installing runtime packages](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/46)
- [KBC-506: Make `/agents` real and role-aware](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/47)
- [KBC-507: Implement bounded custom-agent templates](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/48)
- [KBC-508: Make `/edits` an authoritative approval ledger](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/49)
- [KBC-509: Make `/deployments` a publication ledger, not a Cloudflare dashboard clone](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/50)

## Discovery

- [KBC-601: Verify Phase 1 discovery in preview](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/51)
- [KBC-602: Route approved discovery into media/listing review](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/52)
- [KBC-603: Add discovery admin UI only after runtime proof](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/53)
