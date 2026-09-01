# KBC-003 live deployment graph inventory

**Issue:** [KBC-003 / #22](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/22)

**Verified at:** 2026-08-30T21:55:21Z

**Source baseline:** `main@a3841303b7fb1dd06da8b562bb6ee437bdf8c690`

**Owner / lane:** Cleo, local read-only Cloudflare inventory

**Safety boundary:** This inventory used authenticated read operations plus public `GET /health` requests. It did not deploy code, change traffic, mutate bindings, write secrets, trigger cron handlers, enqueue messages, start Workflows, invoke discovery, verify a candidate, run analyzer jobs, or publish social content. Secret values were not read or recorded.

## Evidence model

Cloudflare treats a Worker Version as an immutable code/configuration snapshot and a Deployment as the traffic assignment to one or more Versions. The table below therefore records both the active deployment and the version receiving traffic. Binding evidence comes from the active version/settings readback, not from Wrangler source alone.

Evidence commands and APIs:

```text
npx wrangler deployments list --name <worker> --json
npx wrangler versions list --name <worker> --json
npx wrangler versions view <version-id> --name <worker> --json
npx wrangler secret list --name <worker> --format json
GET /accounts/{account_id}/workers/scripts/{worker}/settings
GET /accounts/{account_id}/workers/scripts/{worker}/schedules
GET /accounts/{account_id}/workers/scripts/{worker}/subdomain
GET /accounts/{account_id}/workers/domains
GET /zones/{zone_id}/workers/routes
GET /accounts/{account_id}/queues
npx wrangler workflows list --page 1 --per-page 100
npx wrangler ai-search list
```

Cloudflare reference: [Workers Versions and Deployments](https://developers.cloudflare.com/workers/versions-and-deployments/).

## Status summary

| Worker | Active deployment | Active version | Traffic | Runtime status |
| --- | --- | --- | ---: | --- |
| `kiamichi-biz-connect` | `98be2980-2336-40ee-a249-fa68a5abb453` | `b3bb3f95-2727-4fcc-b73a-29bad78c9e78` (#246) | 100% | Deployed; public health `200` |
| `kiamichi-business-agent` | `06bf3b28-bb0a-454a-b9e2-8a678e2505e7` | `9859478e-3b80-4c69-8c93-3f239254ddcb` (#191) | 100% | Deployed; public health `200` |
| `kiamichi-biz-ai-analyzer` | `d7464bf5-4278-4ab3-89a1-159d5d3aef73` | `50a8a518-8260-49bb-9a71-e4d34250f31f` (#113) | 100% | Deployed; public health `200` |
| `kiamichi-facebook-worker` | `f7c10506-7643-4c5e-a5c4-cdc751911dda` | `21c9a608-c933-479e-a6dd-fffad110df7e` (#129) | 100% | Deployed; public health `200` |
| `kiamichi-biz-discovery-worker` | `bf13081e-c78e-4aa9-ba5e-d6b799895446` | `b05d6c15-660f-40d0-94af-f1367415b749` (#1) | 100% | Deployed but intentionally disabled and credential-incomplete; health `200` |
| `kiamichi-biz-verifier` | `d118ee08-ae5d-4c04-8b77-c6d01ad58328` | `92ae6e84-a336-4adb-992b-530c3c80af71` (#1) | 100% | Deployed but credential/config-incomplete; health `200` |

A health response proves only that the fetch handler is reachable. It does not prove downstream credentials, AI Search readiness, scheduled behavior, publication safety, or a full feature flow.

## Routes and public exposure

| Surface | Live route/exposure | Readback |
| --- | --- | --- |
| Main | `kiamichibizconnect.com/*`, `www.kiamichibizconnect.com/*` | Zone routes point to `kiamichi-biz-connect`; workers.dev disabled |
| Business Agent | `app.kiamichibizconnect.com/*` | Zone route and custom domain point to `kiamichi-business-agent`; workers.dev enabled |
| Analyzer | `kiamichi-biz-ai-analyzer.srvcflo.workers.dev` | workers.dev enabled |
| Facebook | `kiamichi-facebook-worker.srvcflo.workers.dev` | workers.dev enabled |
| Discovery | `kiamichi-biz-discovery-worker.srvcflo.workers.dev` | workers.dev enabled |
| Verifier | `kiamichi-biz-verifier.srvcflo.workers.dev` | workers.dev enabled |

Preview subdomains are disabled for the main Worker and enabled for the other five. A preview Version on those Workers can inherit production bindings; it is not an isolated data environment by default.

## Binding graph

### Main Worker: `kiamichi-biz-connect`

- D1: `DB → e8b7b17a-a93b-4b61-92ad-80b488266e12`.
- KV: `CACHE → a5a33e270e4548548d43cf0554323e57`.
- R2: `IMAGES → kiamichi-biz-images`; `BUSINESS_IMAGES → kiamichi-business-images`; `BUSINESS_ASSETS → kiamichi-business-assets`; `TEMPLATES → kiamichi-component-templates`.
- AI/platform: `AI`; `FLAGS → ccdbbf6c-2b94-45b9-b5d5-e0c3d9c3fc5a`.
- Service: `ANALYZER → kiamichi-biz-ai-analyzer` in production.
- Compatibility: `2024-12-09`, `nodejs_compat`.
- Important vars: `ENVIRONMENT=production`; `SITE_URL=https://kiamichibizconnect.com`; `SQUARE_ENVIRONMENT=sandbox`.

### Business Agent: `kiamichi-business-agent`

- Shared D1/KV/R2/AI bindings match the main Worker resource identities.
- Services: `ANALYZER → kiamichi-biz-ai-analyzer`; `FACEBOOK_WORKER → kiamichi-facebook-worker`; `RAG_AGENT → purple-snow-f107-nlweb`, all production service bindings.
- Durable Objects: `Chat → Chat`; `VoiceAgent → VoiceAgent`; `AtlasLive → AtlasLive` with deployed namespace IDs.
- Compatibility: `2025-12-17`, `nodejs_compat`; migration tag `v3`.
- Static assets are deployed in single-page-application mode.

### Analyzer: `kiamichi-biz-ai-analyzer`

- D1/KV/R2: shared `DB`, `CACHE`, and `IMAGES` resources.
- AI/platform: `AI`; shared `FLAGS` app.
- Vars: `ANALYZER_VERSION=1.0.0`; `USE_CODE_MODE=true`; auto-apply threshold `0.95`; maximum three auto-updates per day; main/site URL is `https://kiamichibizconnect.com`.
- Compatibility: `2024-12-09`, `nodejs_compat`.

### Facebook Worker: `kiamichi-facebook-worker`

- D1/KV/R2: shared `DB`, `CACHE`, and `IMAGES` resources.
- AI/platform: `AI`; shared `FLAGS` app; Browser Rendering `BROWSER`.
- Durable Object: `BROWSER_SESSION → BrowserSession`.
- Public social IDs and session-lifetime vars are configured; credentials are secret bindings.
- Compatibility: `2024-12-09`, `nodejs_compat`.

### Discovery: `kiamichi-biz-discovery-worker`

- D1/KV/AI: shared `DB`, `CACHE`, and `AI`.
- Queue: `DISCOVERY_QUEUE → kiamichi-business-discovery`.
- Workflows: `DISCOVERY_WORKFLOW → kiamichi-daily-business-discovery`; `VERIFICATION_WORKFLOW → kiamichi-business-verification`.
- Service: `VERIFIER → kiamichi-biz-verifier` in production.
- Vars: `DISCOVERY_ENABLED=false`; maximum 10 daily discoveries; minimum rating 4; minimum review count 5.
- Compatibility: `2026-08-26`, `nodejs_compat`.
- Live drift: tracked source declares shared `FLAGS`, but the active version does not expose `FLAGS`.

### Verifier: `kiamichi-biz-verifier`

- Active bindings: `AI` only.
- Compatibility: `2026-08-26` with no compatibility flags.
- Live drift: tracked Wrangler configuration declares `FLAGS`, and the source environment expects `FLAGS`, but the active version does not expose it.
- The `/verify` path requires `VERIFIER_SHARED_SECRET`; that secret is absent, so protected verification correctly fails closed even though `/health` is green.

## Secrets by name only

| Worker | Installed secret names |
| --- | --- |
| Main | `ADMIN_GOOGLE_EMAILS`, `ADMIN_KEY`, `FACEBOOK_APP_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `SQUARE_ACCESS_TOKEN`, `SQUARE_APPLICATION_ID`, `SQUARE_WEBHOOK_SIGNATURE_KEY` |
| Business Agent | `ADMIN_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_AI_API`, `CLOUDFLARE_API_TOKEN`, `DEEPGRAM_API_KEY`, `FACEBOOK_APP_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_SECRET`, `HUGGINGFACE_API_KEY`, `OPENAI_API_KEY` |
| Analyzer | `ADMIN_KEY` |
| Facebook | `ADMIN_KEY`, `FACEBOOK_APP_SECRET`, `FB_ACCESS_TOKEN`, `FB_APP_SECRET`, `FB_EMAIL`, `FB_PAGE_ACCESS_TOKEN`, `FB_PASSWORD`, `R2_API_TOKEN`, `R2_S3_ACCESS_KEY_ID`, `R2_S3_SECRET_ACCESS_KEY` |
| Discovery | None |
| Verifier | None |

Discovery source references `ADMIN_KEY`, `FB_ACCESS_TOKEN`, `YELP_API_KEY`, and `VERIFIER_SHARED_SECRET`. `YELP_API_KEY` is required for Yelp discovery; `VERIFIER_SHARED_SECRET` is required for the discovery-to-verifier call; `ADMIN_KEY` is required for a manual run. None are installed. Do not set `DISCOVERY_ENABLED=true` until KBC-601 provisions and verifies the minimum credential set through secure prompts.

## Cron, Queue, and Workflow topology

All cron expressions are UTC.

| Worker | Live schedules |
| --- | --- |
| Main | `15 14 * * *` |
| Business Agent | none |
| Analyzer | `0 2 * * *`, `0 14 * * *`, `0 20 * * *` |
| Facebook | `0 0 * * *`, `0 2,14 * * *`, `0 3,15,22 * * *` |
| Discovery | `0 14 * * *`; handler exits because `DISCOVERY_ENABLED=false` |
| Verifier | none |

Discovery queue resources:

- `kiamichi-business-discovery` (`891244efda4d463090f756c5f71b1305`), producer and consumer `kiamichi-biz-discovery-worker`.
- Batch size 5, maximum 3 retries, 30-second maximum wait, dead-letter queue `kiamichi-business-discovery-dlq`.
- `kiamichi-business-discovery-dlq` (`ff97164408814ea89a2531ea1284a407`).
- Workflows `kiamichi-daily-business-discovery / BusinessDiscoveryWorkflow` and `kiamichi-business-verification / VerificationWorkflow` are attached to the discovery Worker.

## RAG Agent, AI Search, chat, and MCP parity

Identity parity is verified:

1. Business Agent active binding: `RAG_AGENT → purple-snow-f107-nlweb`.
2. Main Worker source calls `https://purple-snow-f107-nlweb.srvcflo.workers.dev/ask`.
3. Chat UI responds at `https://purple-snow-f107-nlweb.srvcflo.workers.dev/` with title `NLWeb Chat`.
4. MCP endpoint exists at `https://purple-snow-f107-nlweb.srvcflo.workers.dev/mcp`; read-only GET returns JSON-RPC `405 Method not allowed`, consistent with a method-gated MCP endpoint.
5. The external Worker binds `RAG_ID=purple-snow-f107`, and the account AI Search instance is also named `purple-snow-f107` with source `kiamichibizconnect.com`.

The external Worker is actively deployed at 100% on version `fd01404f-c4e0-4637-b016-1d88a10e6a1f` via deployment `1be8d2ec-15e8-4be6-840a-cb4fa48baf81`.

**Readiness gap:** AI Search instance `purple-snow-f107` is `paused_user`. KBC-502 must unpause/refresh it deliberately and capture an authenticated MCP initialize/list-tools contract in a non-traffic preview. This inventory did not POST to `/ask` or `/mcp` and does not claim retrieval quality or MCP tool readiness.

## Runtime probes

| Probe | Result |
| --- | --- |
| `GET https://kiamichibizconnect.com/health` | `200`, main Worker identified |
| `GET https://app.kiamichibizconnect.com/health` | `200`, Business Agent reports AI/DB/R2 bindings present |
| Analyzer `/health` | `200`, version `1.0.0` |
| Facebook `/health` | `200` |
| Discovery `/health` | `200` |
| Verifier `/health` | `200` |
| RAG chat `/` | `200`, NLWeb Chat HTML |
| RAG MCP `GET /mcp` | `405`, JSON-RPC method-not-allowed response |

No mutating endpoint was exercised.

## Observability and risk boundaries

- Persisted invocation logs are enabled for all six KBC Workers.
- Top-level observability is enabled for Business Agent, discovery, and verifier; it is disabled for main, analyzer, and Facebook even though invocation-log persistence is on.
- Discovery has bounded daily count, queue retry count, DLQ, and disabled-by-default execution. Its Workflow call cannot succeed until the shared verifier secret exists on both sides.
- RAG Worker has a 15-request-per-60-second rate limiter, but the backing AI Search index is paused.
- Facebook has three live cron groups and credentials installed. Health does not prove posting safety; KBC-406 retains the explicit human approval requirement for external publication.
- Main live health reports the auction-ad feature enabled while product policy requires fixed-price one-hour takeovers. KBC-301 owns replacement of that contract; do not treat the current flag name as product approval.

## Required follow-up owners

- [KBC-601 / #51](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/51): securely install discovery/verifier credentials, reconcile `FLAGS` binding drift, verify a non-traffic preview, and prove duplicate/out-of-region/retry paths before enabling discovery.
- [KBC-502 / #43](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/43): restore AI Search readiness and capture real MCP initialize/list-tools evidence with exact tool allowlisting.
- [KBC-301 / #31](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/31): replace the live auction contract with fixed-price, one-hour placement semantics.
- [KBC-406 / #41](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/41): preserve human review/approval before social or blog publication.

This document is the baseline graph for later roadmap slices. Any release that changes a Worker, route, binding, secret name, cron, Queue, Workflow, Durable Object, or storage resource must update or supersede this inventory with exact version readback.
