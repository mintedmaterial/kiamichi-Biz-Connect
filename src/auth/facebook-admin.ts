/**
 * Facebook OAuth 2.0 for Admin Authentication
 * Handles admin login via Facebook (similar to Google OAuth)
 */

import { Env } from '../types';
import { DatabaseService } from '../database';
import { createAdminSession } from './google';

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v19.0/oauth/access_token';
const FACEBOOK_ME_URL = 'https://graph.facebook.com/v19.0/me';

/**
 * Generate a random state token for CSRF protection
 */
function generateStateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface FacebookUserInfo {
  id: string;
  name: string;
  email: string;
  picture?: {
    data: {
      url: string;
    };
  };
}

/**
 * Step 1: Redirect user to Facebook OAuth consent screen
 */
export async function handleFacebookAdminLogin(request: Request, env: Env): Promise<Response> {
  // Check if Facebook app credentials are configured
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET || env.FACEBOOK_APP_SECRET === 'placeholder') {
    return Response.json({
      error: 'Facebook admin OAuth not configured',
      details: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set'
    }, { status: 503 });
  }

  const url = new URL(request.url);
  const state = generateStateToken();

  // Store state in KV for CSRF validation (expires in 10 minutes)
  await env.CACHE.put(`oauth_state_fb:${state}`, Date.now().toString(), { expirationTtl: 600 });

  const redirectUri = url.origin + '/auth/facebook/callback';

  const authUrl = new URL(FACEBOOK_AUTH_URL);
  authUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'email,public_profile');
  authUrl.searchParams.set('response_type', 'code');

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * Step 2: Handle OAuth callback from Facebook
 */
export async function handleFacebookAdminCallback(
  request: Request,
  env: Env,
  db: DatabaseService
): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    console.error('Facebook OAuth error:', error, errorDescription);
    return new Response(`<html><body><h1>Authentication Failed</h1><p>Error: ${error}</p><p>${errorDescription || ''}</p><a href="/admin">Try again</a></body></html>`, {
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
  const storedState = await env.CACHE.get(`oauth_state_fb:${state}`);
  if (!storedState) {
    return new Response('<html><body><h1>Invalid State</h1><p>CSRF token validation failed</p></body></html>', {
      status: 400,
      headers: { 'Content-Type': 'text/html' }
    });
  }

  // Clean up used state token
  await env.CACHE.delete(`oauth_state_fb:${state}`);

  try {
    // Exchange authorization code for access token
    const redirectUri = url.origin + '/auth/facebook/callback';

    const tokenUrl = new URL(FACEBOOK_TOKEN_URL);
    tokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);

    const tokenResponse = await fetch(tokenUrl.toString());

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokens: FacebookTokenResponse = await tokenResponse.json();

    // Fetch user info from Facebook
    const userInfoUrl = new URL(FACEBOOK_ME_URL);
    userInfoUrl.searchParams.set('fields', 'id,name,email,picture');
    userInfoUrl.searchParams.set('access_token', tokens.access_token);

    const userInfoResponse = await fetch(userInfoUrl.toString());

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Facebook');
    }

    const userInfo: FacebookUserInfo = await userInfoResponse.json();

    // Verify email is authorized
    if (!userInfo.email) {
      return new Response('<html><body><h1>Email Required</h1><p>Your Facebook account must have a verified email address to log in.</p><a href="/admin">Back to login</a></body></html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    const authorizedEmails = env.ADMIN_GOOGLE_EMAILS.split(',').map(e => e.trim().toLowerCase());
    if (!authorizedEmails.includes(userInfo.email.toLowerCase())) {
      console.warn('Unauthorized Facebook login attempt:', userInfo.email);
      return new Response('<html><body><h1>Access Denied</h1><p>Your Facebook account is not authorized to access the admin panel.</p><a href="/admin">Back to login</a></body></html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Create admin session (reuse the same session table as Google OAuth)
    const pictureUrl = userInfo.picture?.data?.url || '';
    const sessionId = await createAdminSession(
      userInfo.email,
      userInfo.name,
      pictureUrl,
      db
    );

    // Set secure session cookie and redirect to admin
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/admin',
        'Set-Cookie': `admin_session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`
      }
    });

  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    return new Response('<html><body><h1>Authentication Error</h1><p>An error occurred during authentication. Please try again.</p><a href="/admin">Back to login</a></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}
