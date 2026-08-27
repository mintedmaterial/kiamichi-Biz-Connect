# Sponsored auction: Square production handoff

## What the application now does

- Homepage sponsored placements render from active `ad_placements` records.
- The **Local now** banner includes sponsored placements and featured businesses; sponsored entries remain visibly labeled.
- Auction cards submit to `/api/auctions/:tier/bids` and redirect only when the API returns a Square checkout URL.
- Bid submission fails closed before creating an advertiser record when checkout configuration is absent.
- Payment activation remains server-side: Square's signed `payment.updated` webhook is the only route that activates an `ad_placements` record.
- The daily auction key switches at **07:00 America/Chicago**, including the midnight-to-07:00 window.
- A verified bid is displayed for at least **one hour**. A later, higher verified bid replaces the placement immediately; displaced paid bids are **not refunded**.

## Square setup

## Sandbox acceptance before production

The reviewed Worker configuration currently uses `SQUARE_ENVIRONMENT = "sandbox"` so the public auction form creates only Square Sandbox checkout links. Enter these **Sandbox application** values through Cloudflare's secure Worker-secret prompts, never through Git or chat:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

In the Square Developer Console for that same Sandbox application, create a webhook subscription for `payment.updated` at `https://kiamichibizconnect.com/api/webhooks/square`, then copy its signature key into the matching Worker secret. The endpoint must be HTTPS and publicly reachable. Complete a Sandbox checkout from `/advertise`, then verify the signed webhook creates the paid placement before moving to production credentials.

When the Sandbox acceptance is complete, use a separate reviewed release to switch `SQUARE_ENVIRONMENT` to `production` and replace all three secrets with values from the production Square application. Do not mix Sandbox and production values.

## Production Square setup

Enter these values only through Cloudflare's secret prompts for the `kiamichi-biz-connect` Worker:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

The checked-in Worker configuration uses `SQUARE_ENVIRONMENT = "production"` and fixes the webhook URL as:

`https://kiamichibizconnect.com/api/webhooks/square`

In Square, register that exact HTTPS notification URL and subscribe to `payment.updated`. Do not activate ads from checkout redirects.

## Worker secret deployment rule

Production deployments preserve the secrets already configured on each Worker. GitHub Actions must not bulk-upload secrets during every deploy: versioned Workers reject that mutation when the latest version is not deployed, which can prevent an otherwise valid release. Rotate or add a secret through Cloudflare's secure Worker-secret prompt, then deploy the reviewed release. Never put a secret value in the repository, workflow, PR, or logs.

## Pre-deploy verification

1. Apply the existing `migrations/010_sponsored_auctions.sql` only after checking the remote schema; this production database already has the relevant auction tables.
2. Deploy the reviewed branch.
3. In Square sandbox or a controlled production test, submit a strictly higher bid and complete checkout.
4. Confirm the webhook has a valid signature and then read back the matching `square_webhook_events`, `sponsored_auction_bids`, `sponsored_auction_hours`, and `ad_placements` rows.
5. Confirm the sponsored business appears on the homepage and the paid placement is visibly labeled.

## Settlement policy

This is a first-price, pay-to-take-over auction. Payment captures in Square checkout; a higher verified bid replaces the visible placement, and the displaced bidder receives no refund. The public copy states this before checkout. This policy should also be included in the advertiser terms before public launch.
