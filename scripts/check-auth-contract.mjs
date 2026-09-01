import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(rootDir, path), 'utf8');
const index = read('src/index.ts');
const admin = read('src/admin.ts');
const github = read('src/auth/github.ts');
const middleware = read('src/auth/middleware.ts');
const facebook = read('src/facebook-oauth.ts');
const businessAgent = read('workers/business-agent/src/server.ts');
const database = read('src/database.ts');
const facebookWorker = read('workers/facebook-worker/src/index.ts');

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function rejectText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

requireText(index, "path === '/auth/github/login'", 'GitHub admin login route is missing');
requireText(index, "path === '/auth/callback/github'", 'GitHub admin callback route is missing');
requireText(admin, 'href="/auth/github/login"', 'Admin login page must offer GitHub sign-in');
requireText(middleware, "new URL('/auth/github/login'", 'Admin middleware must redirect to GitHub');
rejectText(index, "path === '/auth/google/login'", 'Google admin login route must remain disabled');
rejectText(index, "path === '/auth/facebook/admin/login'", 'Facebook admin login route must remain disabled');
rejectText(admin, 'href="/auth/google/login"', 'Admin page must not offer Google sign-in');
rejectText(admin, 'href="/auth/facebook/admin/login"', 'Admin page must not offer Facebook admin sign-in');

requireText(github, "code_challenge_method', 'S256'", 'GitHub OAuth must use PKCE S256');
requireText(github, 'code_verifier: codeVerifier', 'GitHub token exchange must include the PKCE verifier');
requireText(github, 'oauth_state_github:', 'GitHub OAuth state must use a provider-specific namespace');
requireText(github, 'item.primary && item.verified', 'GitHub authorization must use a verified primary email');
rejectText(github, 'emails[0]', 'GitHub authorization must not fall back to an unverified email');
rejectText(github, 'Session created for:', 'Admin identities must not be logged');

requireText(facebook, "'public_profile,pages_show_list,pages_read_engagement'", 'Facebook listing import must request read-only Page permissions');
rejectText(facebook, 'pages_manage_posts', 'Facebook listing import must not request publishing permission');
requireText(index, "const FACEBOOK_SUBMIT_COOKIE = '__Host-kbc_fb_connect'", 'Facebook connection must use the secure host-only cookie');
requireText(index, 'HttpOnly; Secure; SameSite=Lax; Path=/', 'Facebook connection cookie must be HttpOnly and secure');
requireText(index, 'connection.session.pages.map(publicFacebookPage)', 'Facebook Page responses must be sanitized');
requireText(index, 'page.id === pageId', 'Selected Facebook Page must belong to the connected account');
requireText(index, "request.method !== 'POST'", 'Facebook Page selection must use a non-GET request');
requireText(index, "origin !== new URL(env.SITE_URL).origin", 'Facebook Page selection must enforce same-origin requests');
requireText(index, "source: 'meta_oauth_managed_page'", 'Submission must record Facebook provenance');
rejectText(index, 'fb_session', 'Facebook connection IDs must not appear in browser URLs or JavaScript');
rejectText(index, 'name="is_verified"', 'Public submissions must not control verification state');
rejectText(index, "formData.get('is_verified')", 'Server must not trust public verification input');
rejectText(index, '[name="facebook_rating"]', 'Facebook auto-fill must not write to removed rating controls');
requireText(businessAgent, 'https://kiamichibizconnect.com/auth/github/login', 'Business Agent must use the live GitHub admin login route');
rejectText(businessAgent, 'https://kiamichibizconnect.com/auth/google/login', 'Business Agent must not redirect to the disabled Google route');
requireText(admin, "^\\d+$/.test(extra.facebook_connection.page_id)", 'Approval must validate the Facebook Page ID before persistence');
requireText(admin, 'facebook_page_id: verifiedFacebookPageId', 'Approval must preserve the validated Facebook Page ID');
requireText(database, 'business.facebook_page_id ?? null', 'Business creation must persist the validated Facebook Page ID');
requireText(facebookWorker, "^\\d+$/.test(biz.facebook_page_id)", 'Facebook automation must validate the persisted Page ID');
requireText(facebookWorker, 'const pageId = storedPageId || (biz.facebook_url', 'Facebook automation must prefer the persisted Page ID with a legacy URL fallback');
requireText(facebookWorker, 'facebook_page_id IS NOT NULL OR facebook_url IS NOT NULL', 'Facebook enrichment must include listings with a persisted Page ID and no URL');

console.log('Admin GitHub and business Facebook auth contracts verified.');
