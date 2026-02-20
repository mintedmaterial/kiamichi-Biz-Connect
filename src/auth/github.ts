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

/**
 * Step 1: Redirect user to GitHub OAuth consent screen
 */
export async function handleGitHubLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = generateStateToken();

  // Store state in KV for CSRF validation (expires in 10 minutes)
  await env.CACHE.put(`oauth_state:${state}`, Date.now().toString(), { expirationTtl: 600 });

  const redirectUri = url.origin + '/auth/callback/github';

  const authUrl = new URL(GITHUB_AUTH_URL);
  authUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'read:user user:email');
  authUrl.searchParams.set('state', state);

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
    console.error('GitHub OAuth error:', error);
    return new Response(`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><a href="/admin">Try again</a></body></html>`, {
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
  const storedState = await env.CACHE.get(`oauth_state:${state}`);
  if (!storedState) {
    return new Response('<html><body><h1>Invalid State</h1><p>CSRF token validation failed</p></body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Clean up used state token
  await env.CACHE.delete(`oauth_state:${state}`);

  try {
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
        redirect_uri: url.origin + '/auth/callback/github'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('GitHub token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokens: GitHubTokenResponse = await tokenResponse.json();

    if (!tokens.access_token) {
      console.error('No access token in response:', tokens);
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

    // Get user's primary email (might not be public)
    let email = userInfo.email;
    if (!email) {
      const emailsResponse = await fetch(GITHUB_USER_EMAILS_URL, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'KiamichiBizConnect'
        }
      });

      if (emailsResponse.ok) {
        const emails: GitHubEmail[] = await emailsResponse.json();
        const primaryEmail = emails.find(e => e.primary && e.verified);
        email = primaryEmail?.email || emails[0]?.email || null;
      }
    }

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
      console.warn('Unauthorized GitHub login attempt:', email);
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

    console.log('[GitHub OAuth] Session created for:', email);

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
