/**
 * Google OAuth 2.0 Implementation
 * Handles admin authentication via Google Sign-In
 */

import { Env } from '../types';
import { DatabaseService } from '../database';
import { AdminSession, GoogleTokenResponse, GoogleUserInfo } from './types';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Generate a random state token for CSRF protection
 */
function generateStateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a UUID v4 for session IDs
 */
function generateUUID(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);

  // Set version (4) and variant bits
  array[6] = (array[6] & 0x0f) | 0x40;
  array[8] = (array[8] & 0x3f) | 0x80;

  const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

/**
 * Step 1: Redirect user to Google OAuth consent screen
 */
export async function handleGoogleLogin(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const state = generateStateToken();

  // Store state in KV for CSRF validation (expires in 10 minutes)
  await env.CACHE.put(`oauth_state:${state}`, Date.now().toString(), { expirationTtl: 600 });

  const redirectUri = url.origin + '/auth/google/callback';

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'online');
  authUrl.searchParams.set('prompt', 'select_account');

  return Response.redirect(authUrl.toString(), 302);
}

/**
 * Step 2: Handle OAuth callback from Google
 */
export async function handleGoogleCallback(
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
    console.error('Google OAuth error:', error);
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
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: url.origin + '/auth/google/callback',
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to exchange authorization code for token');
    }

    const tokens: GoogleTokenResponse = await tokenResponse.json();

    // Fetch user info from Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { 'Authorization': 'Bearer ' + tokens.access_token }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info from Google');
    }

    const userInfo: GoogleUserInfo = await userInfoResponse.json();

    // Verify email is authorized
    const authorizedEmails = env.ADMIN_GOOGLE_EMAILS.split(',').map(e => e.trim().toLowerCase());
    if (!authorizedEmails.includes(userInfo.email.toLowerCase())) {
      console.warn('Unauthorized login attempt:', userInfo.email);
      return new Response('<html><body><h1>Access Denied</h1><p>Your Google account is not authorized to access the admin panel.</p><a href="/admin">Back to login</a></body></html>', {
        status: 403,
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Create admin session
    const sessionId = await createAdminSession(
      userInfo.email,
      userInfo.name,
      userInfo.picture,
      db
    );

    console.log('[Google OAuth] Session created, setting cookie and redirecting...');
    console.log('[Google OAuth] Session ID:', sessionId);
    console.log('[Google OAuth] User:', userInfo.email);

    // Set secure session cookie and redirect to admin
    // Use SameSite=Lax for initial login (same-site), will be upgraded to None when accessing subdomain
    // Domain=.kiamichibizconnect.com allows cookie to work on all subdomains

    // We need to set TWO cookies to handle both domain and non-domain variants
    // This ensures we overwrite any old cookies
    const headers = new Headers();
    headers.set('Location', '/admin');

    // Clear any existing cookies (both with and without domain)
    headers.append('Set-Cookie', `admin_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`);
    headers.append('Set-Cookie', `admin_session=; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/`);

    // Set the new session cookie with domain
    headers.append('Set-Cookie', `admin_session=${sessionId}; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=Lax; Max-Age=86400; Path=/`);

    console.log('[Google OAuth] Setting cookies to clear old and set new session');

    return new Response(null, {
      status: 302,
      headers
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response('<html><body><h1>Authentication Error</h1><p>An error occurred during authentication. Please try again.</p><a href="/admin">Back to login</a></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

/**
 * Create a new admin session in the database
 */
export async function createAdminSession(
  email: string,
  name: string,
  picture: string,
  db: DatabaseService
): Promise<string> {
  const sessionId = generateUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 86400; // 24 hours

  await db.db.prepare(`
    INSERT INTO admin_sessions (id, user_email, user_name, user_picture, created_at, expires_at, last_activity)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(sessionId, email, name, picture, now, expiresAt, now).run();

  console.log('Created admin session:', sessionId, 'for', email);

  return sessionId;
}

/**
 * Verify admin session and return session data
 */
export async function verifyAdminSession(
  sessionId: string | null,
  db: DatabaseService
): Promise<AdminSession | null> {
  if (!sessionId) return null;

  const session = await db.db.prepare(`
    SELECT * FROM admin_sessions WHERE id = ?
  `).bind(sessionId).first();

  if (!session) return null;

  const now = Math.floor(Date.now() / 1000);
  const sessionData = session as unknown as AdminSession;

  // Check if session expired
  if (sessionData.expires_at < now) {
    // Clean up expired session
    await db.db.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run();
    return null;
  }

  // Update last activity timestamp
  await db.db.prepare(`
    UPDATE admin_sessions SET last_activity = ? WHERE id = ?
  `).bind(now, sessionId).run();

  return sessionData;
}

/**
 * Destroy admin session (logout)
 */
export async function destroyAdminSession(
  sessionId: string,
  db: DatabaseService
): Promise<void> {
  await db.db.prepare('DELETE FROM admin_sessions WHERE id = ?').bind(sessionId).run();
  console.log('Destroyed admin session:', sessionId);
}

/**
 * Handle logout - destroy session and redirect
 */
export async function handleLogout(
  request: Request,
  env: Env,
  db: DatabaseService
): Promise<Response> {
  const cookies = request.headers.get('Cookie') || '';
  const sessionMatch = cookies.match(/admin_session=([^;]+)/);

  if (sessionMatch) {
    await destroyAdminSession(sessionMatch[1], db);
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Location': '/admin',
      'Set-Cookie': 'admin_session=; Domain=.kiamichibizconnect.com; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/'
    }
  });
}

/**
 * Cleanup expired sessions (call this periodically via cron)
 */
export async function cleanupExpiredSessions(db: DatabaseService): Promise<number> {
  const now = Math.floor(Date.now() / 1000);
  const result = await db.db.prepare(`
    DELETE FROM admin_sessions WHERE expires_at < ?
  `).bind(now).run();

  const deleted = result.meta?.changes || 0;
  if (deleted > 0) {
    console.log('Cleaned up', deleted, 'expired admin sessions');
  }

  return deleted;
}
