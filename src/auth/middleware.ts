/**
 * Authentication Middleware
 * Provides helpers for requiring authentication on routes
 */

import { Env } from '../types';
import { DatabaseService } from '../database';
import { verifyAdminSession } from './google';
import { AuthResult } from './types';

/**
 * Extract cookie value from request
 */
function getCookie(request: Request, name: string): string | null {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Require admin authentication
 * Returns authorization status and session data if authorized
 */
export async function requireAdminAuth(
  request: Request,
  env: Env,
  db: DatabaseService
): Promise<AuthResult> {
  const sessionId = getCookie(request, 'admin_session');

  if (!sessionId) {
    return { authorized: false, error: 'No session cookie' };
  }

  const session = await verifyAdminSession(sessionId, db);

  if (!session) {
    return { authorized: false, error: 'Invalid or expired session' };
  }

  return { authorized: true, session };
}

/**
 * Middleware wrapper that redirects to login if not authenticated
 * Use this to wrap handlers that require authentication
 */
export async function withAdminAuth(
  request: Request,
  env: Env,
  db: DatabaseService,
  handler: (request: Request, env: Env, db: DatabaseService, session: any) => Promise<Response>
): Promise<Response> {
  const authResult = await requireAdminAuth(request, env, db);

  if (!authResult.authorized) {
    // Redirect to Google login
    return Response.redirect(new URL('/auth/google/login', request.url).toString(), 302);
  }

  // Call the protected handler with session data
  return handler(request, env, db, authResult.session);
}

/**
 * Check if request is from authenticated admin (for API endpoints)
 * Returns 401 JSON response if not authorized
 */
export async function requireAdminAuthAPI(
  request: Request,
  env: Env,
  db: DatabaseService
): Promise<Response | null> {
  const authResult = await requireAdminAuth(request, env, db);

  if (!authResult.authorized) {
    return Response.json(
      { error: 'Unauthorized', message: authResult.error },
      { status: 401 }
    );
  }

  // Return null = authorized (handler can proceed)
  return null;
}
