# Kiamichi Facebook Worker

This is an independent Cloudflare Worker that posts highlights and blog links to the Kiamichi Facebook group.

Setup

- Install Wrangler and login: `wrangler login`
- From this folder run `wrangler publish` (or `wrangler dev` to test).
- Set secrets required by the worker:

```powershell
wrangler secret put FB_ACCESS_TOKEN
wrangler secret put FB_GROUP_ID
```

Notes

- The worker uses the same D1 database as the main site (configured in `wrangler.toml`).
- The worker exposes two routes:
  - `POST /run` — manually trigger a run (JSON body `{ "test": true }` will prefix message with `[TEST]`).
  - `GET|POST /webhooks/facebook` — endpoint for Facebook webhook verification and payloads.
- The worker is configured with a cron in `wrangler.toml` to run daily; adjust as needed.

Data deletion callback

- This worker exposes `POST /data-deletion` which accepts a JSON payload from Facebook and returns a JSON response with `confirmation_code` and a `url` where the request status can be checked.
- After you deploy this worker, set your App's "Data Deletion Callback URL" to the worker's `/data-deletion` URL (for example: `https://<your-worker-domain>/data-deletion`).
- You can check request status via `GET /data-deletion/status?code=<confirmation_code>`.
