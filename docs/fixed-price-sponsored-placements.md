# Fixed-price sponsored placements

## Customer-facing rules

- **Local Spotlight:** first available placement is **$5.00**.
- **Regional Spotlight:** first available placement is **$25.00**.
- A successful Square payment activates exactly one sponsored placement for a **minimum of one hour**.
- During the guarantee, the checkout endpoint rejects replacement attempts with HTTP 409 and exposes the guarantee end time.
- Once the hour has elapsed, a Local Spotlight replacement is **$6.00**. The Regional Spotlight replacement is its $25.00 floor plus $1.00 (**$26.00**).
- The public UI uses *Sponsored Placement*, *checkout*, and *guaranteed hour*. It contains no customer-facing bidding or auction flow.

## Payment lifecycle

1. The advertiser enters business/contact details at `/advertise`.
2. KBC creates a fixed-price Square Payment Link, saves a `checkout_pending` record, and sends the browser to the link with an HTTP 303 redirect. This is a standard form submission, so checkout does not depend on inline JavaScript initializing.
3. Square calls `POST /api/webhooks/square` after completion.
4. KBC validates the Square signature against the exact subscription URL, verifies the final payment amount, then creates the active `ad_placements` record for one hour.
5. A conflicting payment that arrives after a newly activated guarantee is persisted as `manual_refund_required`; it is not silently activated.

## Operational guardrails

- Configure the signature key from the Square **Sandbox webhook subscription associated with the Sandbox app and KBC webhook URL**. Do not reuse a production subscription key.
- Apply `migrations/011_fixed_price_sponsored_placements.sql` before deploying code that creates a checkout.
- Verify a test transaction only after Square reports `payment.updated` as `COMPLETED`; check the matching `sponsored_placement_purchases` row and its active `ad_placements` record.
- This is a payment-bearing release: a human must explicitly approve the D1 migration and production deploy.
