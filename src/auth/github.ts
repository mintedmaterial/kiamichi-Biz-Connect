/**
 * GitHub OAuth 2.0 Implementation
 * Handles admin authentication via GitHub Sign-In
 */

import { Env } from '../types';
import { DatabaseService } from '../database';
import { createAdminSession } from './google';

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USERINFO_URL = 'https://api.github.com/user';
const GITHUB_USER_EMAILS_URL = 'https://api.github.com/user/emails';

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Generate a random state token for CSRF protection
 */
function generateStateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

/**
 * Step 1: Redirect user to GitHub OAuth consent screen
 */
export async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return Response.json({ error: 'GitHub admin authentication is not configured' }, { status: 503 });
  }

  const url = new URL(request.url);
  const state = generateStateToken();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await createCodeChallenge(codeVerifier);

  await env.CACHE.put(
    `oauth_state_github:${state}`,
    JSON.stringify({ codeVerifier, createdAt: Date.now() }),
    { expirationTtl: 600 }
  );

  const redirectUri = url.origin + '/auth/callback/github';

  const authUrl = new URL(GITHUB_AUTH_URL);
  authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * Step 2: Handle OAuth callback from GitHub
 */
export async function handleGitHubCallback(
  request: Request,
  env: Env,
  db: DatabaseService
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    console.warn('GitHub OAuth was not completed');
    return new Response('<html><body><h1>Authentication Failed</h1><p>GitHub sign-in was not completed.</p><a href="/admin">Try again</a></body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Validate required parameters
  if (!code || !state) {
    return new Response('<html><body><h1>Invalid Request</h1><p>Missing code or state parameter</p></body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Verify state token (CSRF protection)
  const stateKey = `oauth_state_github:${state}`;
  const storedState = await env.CACHE.get(stateKey);
  if (!storedState) {
    return new Response('<html><body><h1>Invalid State</h1><p>CSRF token validation failed</p></body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Delete before token exchange so callback replay fails closed.
  await env.CACHE.delete(stateKey);

  try {
    const { codeVerifier } = JSON.parse(storedState) as { codeVerifier?: string };
    if (!codeVerifier) throw new Error('Missing PKCE verifier');

    // Exchange authorization code for access token
    const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: url.origin + '/auth/callback/github',
        code_verifier: codeVerifier
      })
    });

    if (!tokenResponse.ok) {
      console.error('GitHub token exchange failed with status', tokenResponse.status);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokens: GitHubTokenResponse = await tokenResponse.json();

    if (!tokens.access_token) {
      throw new Error('No access token received from GitHub');
    }

    // Fetch user info from GitHub
    const userInfoResponse = await fetch(GITHUB_USERINFO_URL, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KiamichiBizConnect'
      }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from GitHub');
    }

    const userInfo: GitHubUserInfo = await userInfoResponse.json();

    // Authorization is based only on GitHub's verified primary email.
    const emailsResponse = await fetch(GITHUB_USER_EMAILS_URL, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'KiamichiBizConnect'
      }
    });

    if (!emailsResponse.ok) {
      throw new Error('Failed to fetch verified GitHub email');
    }

    const emails: GitHubEmail[] = await emailsResponse.json();
    const email = emails.find(item => item.primary && item.verified)?.email || null;

    if (!email) {
      return new Response('<html><body><h1>Email Required</h1><p>Could not retrieve email from GitHub. Please ensure your email is visible or add a public email to your GitHub profile.</p><a href="/admin">Back to login</a></body></html>', {
        status: 400,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Check if user is a site admin
    const siteAdmin = await db.db.prepare(`
      SELECT role FROM site_admins WHERE LOWER(email) = LOWER(?)
    `).bind(email).first();

    if (!siteAdmin) {
      console.warn('Unauthorized GitHub login attempt denied');
      return new Response('<html><body><h1>Access Denied</h1><p>Your GitHub account is not authorized to access the admin panel.</p><a href="/admin">Back to login</a></body></html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Create admin session
    const sessionId = await createAdminSession(
      email,
      userInfo.name || userInfo.login,
      userInfo.avatar_url,
      db
    );


    // Set secure session cookie and redirect to admin
    const headers = new Headers();
    headers.set('Location', '/admin');

    // Clear any existing cookies
    headers.append('Set-Cookie', `admin_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`);
    headers.append('Set-Cookie', `admin_session=; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`);

    // Set the new session cookie with domain
    headers.append('Set-Cookie', `admin_session=${sessionId}; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`);

    return new Response(null, {
      status: 302,
      headers
    });

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return new Response('<html><body><h1>Authentication Error</h1><p>An error occurred during authentication. Please try again.</p><a href="/admin">Back to login</a></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
