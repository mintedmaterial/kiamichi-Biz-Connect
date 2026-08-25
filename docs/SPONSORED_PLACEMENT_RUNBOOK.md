# KBC Sponsored Placement and Published Pages

## Auction contract

Kiamichi Biz Connect uses a first-price sponsored-placement model. A business pays the amount of its accepted bid. Organic directory ranking remains separate from sponsored inventory, and sponsored cards must be labeled as sponsored/featured advertising.

- Daily cycle starts at 7:00 a.m. America/Chicago.
- Initial configured floors are 500 cents ($5) for `local-spotlight` and 2,500 cents ($25) for `regional-spotlight`.
- Each auction slot runs for a 24-hour Chicago-local auction day.
- Only a strictly higher valid bid replaces the current winner.
- A paid winner holds the placement for the rest of that 24-hour auction day unless a higher bid beats it.
- At the daily reset, the opening bid is the arithmetic average of valid winning bids settled during the prior 24 hours, rounded up to whole dollars and clamped to the tier floor.
- Empty, stale, malformed, future, or non-positive history is ignored; the floor is used when no valid history remains.

The migration creates `sponsored_auction_tiers`, `sponsored_auction_hours`, `sponsored_auction_bids`, and the deduplication table `square_webhook_events`. New bids remain `pending-square` until Square payment verification exists.

## Published business pages

The business-agent publishes HTML into `BUSINESS_ASSETS` and records the artifact in `published_pages_r2`. The public Worker may serve only a published artifact whose business slug matches the requested route and whose key is exactly one of:

- `business/{slug}/index.html`
- `pages/{slug}/index.html`

If the portal tables, artifact, or R2 object are unavailable, the public Worker falls back to the existing server-rendered `/business/{slug}` page. Drafts and cross-business keys are not eligible.

## Square handoff

Square is the payment authority. The flow is: submit a bid through `POST /api/auctions/{tierId}/bids`, keep it pending until the bidder completes Square checkout, receive and verify `payment.updated` at `POST /api/webhooks/square`, deduplicate by Square `event_id`, verify completed payment state server-side, then activate the corresponding 24-hour placement. A pending bid does not occupy the slot, and a payment arriving after a higher paid bid is rejected as outbid. Do not activate from a browser redirect or an unverified client payload.

The webhook now:

- validates the Square webhook signature when `SQUARE_WEBHOOK_SIGNATURE_KEY` and `SQUARE_WEBHOOK_URL` are configured
- stores each event in `square_webhook_events` for dedupe/audit
- marks the bid as square-paid when the payment completes
- activates the matching `ad_placements` record for the tier so the live homepage/sidebar inventory can show it

Required Square runtime settings:

- `SQUARE_ACCESS_TOKEN` for the payment-link and order lookup calls
- `SQUARE_LOCATION_ID` for payment-link creation
- `SQUARE_WEBHOOK_SIGNATURE_KEY` for webhook verification
- `SQUARE_WEBHOOK_URL` set to the exact webhook URL registered in Square
- optional `SQUARE_ENVIRONMENT=sandbox` for test mode

## Verification

Before merge/deploy, run the repository typecheck/build and focused auction tests. Apply the D1 migration only through the normal reviewed migration path. Verify a published R2 page through a bounded GET/readback; some R2 public endpoints may reject HEAD while accepting ranged GET with `206`.
