# KBC-004 admin and business Facebook authentication boundary

**GitHub issue:** [#59](https://github.com/mintedmaterial/kiamichi-Biz-Connect/issues/59)
**Worker:** `kiamichi-biz-connect`
**Production origin:** `https://kiamichibizconnect.com`

## Decision

Kiamichi staff administration and business-owned Facebook connections are separate trust planes.

- `/admin` is for authorized Kiamichi staff. Cloudflare Access is the outer edge gate. GitHub OAuth is the application identity provider. Active membership in D1 `site_admins` is the authorization gate before an admin session is created.
- `/submit` remains public. A business representative may connect a Facebook account long enough to select a Page they manage and import read-only Page details into a pending submission.
- Facebook is not an admin identity provider. A connected Page does not verify, approve, claim, or publish a listing.
- Google admin OAuth is not exposed by the main Worker.

## Application routes

| Route | Audience | Contract |
| --- | --- | --- |
| `/admin` and `/admin/*` | Kiamichi staff | Requires an application admin session; unauthenticated requests render GitHub sign-in. |
| `/auth/github/login` | Kiamichi staff | Starts GitHub OAuth with provider-scoped state and PKCE. |
| `/auth/callback/github` | Kiamichi staff | Requires single-use state, PKCE token exchange, verified primary GitHub email, and active D1 `site_admins` membership. |
| `/auth/logout` | Kiamichi staff | Revokes the application session. |
| `/submit` | Public businesses | Renders the listing-submission form and optional Facebook Page connection. |
| `/auth/facebook` | Public businesses | Starts a read-only Meta OAuth flow for `/submit`. |
| `/auth/facebook/callback` | Public businesses | Consumes single-use state, discovers managed Pages, and creates a one-hour HttpOnly connection cookie. |
| `/auth/facebook/pages` | Connected submitter | Returns only Page ID, name, and category—never user or Page tokens. |
| `/auth/facebook/page-info` | Connected submitter | Accepts only a Page ID present in the server-side managed-Page set, fetches data with the corresponding Page token, and records the selected Page server-side. |

The legacy Google and Facebook-admin login routes return `404` because they are no longer registered.

## Facebook submission data contract

The browser may edit normal listing fields after auto-fill. Trust-sensitive provenance remains server-owned.

- Requested Meta scopes are `public_profile`, `pages_show_list`, and `pages_read_engagement`.
- `pages_manage_posts` is not requested.
- User and Page access tokens remain in short-lived KV state and are never returned in browser JSON, query strings, HTML, logs, or D1.
- The connection identifier is a `Secure`, `HttpOnly`, `SameSite=Lax`, host-only cookie with a one-hour maximum age.
- A successful submission deletes the short-lived KV session and expires the cookie.
- The pending submission records `facebook_connection.source = meta_oauth_managed_page`, Page ID, Page name, and connection time.
- Approval requires `facebook_connection.source = meta_oauth_managed_page` and copies only a numeric server-validated Page ID into `businesses.facebook_page_id`. Downstream presentation and Facebook automation prefer that immutable identity, reject malformed stored IDs, and use a canonical Facebook Page URL for ID-only listings. Legacy rows without a valid stored Page ID may fall back to a nonempty URL, and successful enrichment backfills the authoritative column.
- Public clients cannot submit `is_verified`, Google rating, Google review count, Facebook rating, or Facebook review count as authoritative values. Facebook rating metadata is accepted only from the selected server-validated Page response.
- Approval remains a human admin action. No external publication occurs from this flow.

KV is temporary OAuth/session state, not authoritative ownership. D1 retains only the pending submission and sanitized provenance needed for staff review.

## Cloudflare Access production gate

Create a dedicated self-hosted Access application only after the reviewed Worker version is deployed and its application auth paths pass runtime verification.

| Setting | Required value |
| --- | --- |
| Application destination | `kiamichibizconnect.com/admin*` |
| Identity provider | Existing account GitHub Access IdP |
| Session duration | Short staff session, no broader than one workday |
| Allow policy | Explicit approved Kiamichi staff identities only |
| Login method requirement | GitHub IdP |
| Bypass policy | None for `/admin*` |

Do not protect `/submit`, `/auth/facebook`, or `/auth/facebook/callback` with this Access application. Do not use an account-wide, zone-wide, or all-Workers destination.

Access does not replace application authorization. The Worker must continue to require D1 `site_admins` membership after GitHub identity resolution.

## Pull-request preview boundary

- Preview CI runs on Node.js 22 and fails unless all four Worker preview deployments succeed.
- Main, Business Agent, Analyzer, and Facebook preview Workers bind only to `kiamichi-biz-connect-preview-db`, `kiamichi-biz-connect-preview-CACHE`, preview R2 buckets, and preview service names.
- Analyzer and Facebook preview environments have empty cron schedules. The Analyzer also disables automatic updates and Code Mode.
- Preview deployments do not copy admin, OAuth, Facebook login, or Facebook app secrets. A separate GitHub OAuth App and preview callback registration are required before GitHub login-start/callback can be accepted as a preview-runtime auth proof.
- The Business Agent build must run with `CLOUDFLARE_ENV=preview`; otherwise its Vite-generated redirected Wrangler config resolves production bindings before the deploy command runs.
- Preview Workers use `workers.dev` only and declare no production custom-domain routes.

## Release and verification gates

1. Run `npm run check:auth`, `npm run smoke:main`, and `npm run build` on the exact commit.
2. Confirm Wrangler dry-run shows the existing `CACHE`, `DB`, `FACEBOOK_APP_ID`, and secret-name contract without exposing values.
3. Verify the production GitHub OAuth App callback is exactly `https://kiamichibizconnect.com/auth/callback/github`.
4. Verify the Meta App valid OAuth redirect URI is exactly `https://kiamichibizconnect.com/auth/facebook/callback`, and verify its public privacy-policy surface independently.
5. Upload a non-traffic preview version. Because it inherits production bindings, perform only read-only/login-start checks unless an isolated preview environment exists.
6. Require PR-checker, Curator, deep review, independent tests, and current-head CI before merge.
7. Obtain explicit production approval, deploy the exact reviewed commit, and read back the active Worker version and bindings.
8. Verify GitHub login start includes state, PKCE challenge, and the exact callback. Complete an allowlisted login and verify `/admin` renders the authenticated shell. Verify an unlisted identity is denied.
9. Complete a Meta connection with a test business Page. Verify Page lists are sanitized, arbitrary Page IDs return `403`, submission provenance is stored, and no listing is auto-approved or published.
10. Create the path-scoped Access application, read back its destination/IdP/policy, and verify an unauthenticated `/admin` request redirects to the Cloudflare Access team domain while `/submit` remains public.
11. Record rollback Worker version and Access application/policy IDs. Roll back application and edge changes independently if either layer fails.

## Known separate debt

Dependency advisories, the Business Agent `flagship` configuration warning, and bundle chunk warnings predate this slice. They remain separate remediation work and do not weaken the auth acceptance gates above.
