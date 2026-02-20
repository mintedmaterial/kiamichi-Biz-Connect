/**
 * Session Utilities
 * Helper functions for managing portal sessions and business ownership
 */

export interface SessionInfo {
  sessionId: string;
  ownerId: string;
  expiresAt: number | null;
  lastActivity: number | null;
}

export interface BusinessOwnership {
  businessId: number;
  businessName: string;
  businessSlug: string;
  claimStatus: string;
}

/**
 * Parse session cookie from request
 */
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) {
    return null;
  }

  // Extract admin_session cookie (used by main worker)
  const sessionMatch = cookieHeader.match(/admin_session=([^;]+)/);
  return sessionMatch ? sessionMatch[1] : null;
}

/**
 * Verify session and get session info
 * Note: admin_sessions table uses user_email as the owner identifier
 */
export async function verifySession(
  sessionId: string,
  db: D1Database
): Promise<SessionInfo | null> {
  try {
    const session = await db
      .prepare(
        `
        SELECT id, user_email, expires_at, last_activity
        FROM admin_sessions
        WHERE id = ?
      `
      )
      .bind(sessionId)
      .first();

    if (!session) {
      return null;
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      return null;
    }

    return {
      sessionId: session.id as string,
      ownerId: session.user_email as string, // Use email as owner ID
      expiresAt: session.expires_at as number | null,
      lastActivity: session.last_activity as number | null
    };
  } catch (error) {
    console.error("[Session] Error verifying session:", error);
    return null;
  }
}

/**
 * Get verified businesses for an owner
 * Note: ownerId is the user's email from admin_sessions.user_email
 */
export async function getOwnerBusinesses(
  ownerEmail: string,
  db: D1Database
): Promise<BusinessOwnership[]> {
  try {
    const { results } = await db
      .prepare(
        `
        SELECT
          bo.business_id,
          bo.claim_status,
          b.name as business_name,
          b.slug as business_slug
        FROM business_owners bo_table
        JOIN business_ownership bo ON bo.owner_id = bo_table.id
        JOIN businesses b ON bo.business_id = b.id
        WHERE bo_table.email = ? AND bo.claim_status = 'verified'
        ORDER BY b.name ASC
      `
      )
      .bind(ownerEmail)
      .all();

    if (!results || results.length === 0) {
      return [];
    }

    return results.map((row: any) => ({
      businessId: row.business_id,
      businessName: row.business_name,
      businessSlug: row.business_slug,
      claimStatus: row.claim_status
    }));
  } catch (error) {
    console.error("[Session] Error getting owner businesses:", error);
    return [];
  }
}

/**
 * Get business ID from session cookie
 * Returns the first verified business owned by the session owner
 */
export async function getBusinessIdFromSession(
  request: Request,
  db: D1Database
): Promise<number | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    return null;
  }

  const sessionInfo = await verifySession(sessionId, db);
  if (!sessionInfo) {
    return null;
  }

  const businesses = await getOwnerBusinesses(sessionInfo.ownerId, db);
  if (businesses.length === 0) {
    return null;
  }

  // Return the first business (in the future, we can support multiple businesses)
  return businesses[0].businessId;
}

/**
 * Check if user is a site admin/developer
 */
export async function isAdminUser(
  email: string,
  db: D1Database
): Promise<{ isAdmin: boolean; role: string | null }> {
  try {
    const admin = await db
      .prepare(`SELECT role FROM site_admins WHERE email = ?`)
      .bind(email)
      .first();
    
    if (admin) {
      return { isAdmin: true, role: admin.role as string };
    }
    return { isAdmin: false, role: null };
  } catch (error) {
    console.error("[Session] Error checking admin status:", error);
    return { isAdmin: false, role: null };
  }
}

/**
 * Get all businesses (for admin users)
 */
export async function getAllBusinesses(
  db: D1Database
): Promise<Array<{ id: number; name: string; slug: string; categoryName: string | null }>> {
  try {
    const { results } = await db
      .prepare(`
        SELECT b.id, b.name, b.slug, c.name as category_name
        FROM businesses b
        LEFT JOIN categories c ON b.category_id = c.id
        ORDER BY b.name ASC
      `)
      .all();
    
    return (results || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      categoryName: row.category_name
    }));
  } catch (error) {
    console.error("[Session] Error getting all businesses:", error);
    return [];
  }
}

/**
 * Get full business context from session
 */
export async function getBusinessContextFromSession(
  request: Request,
  db: D1Database
): Promise<{
  businessId: number;
  businessName: string;
  businessSlug: string;
  ownerId: string;
  sessionId: string;
} | null> {
  const cookieHeader = request.headers.get("Cookie");
  const sessionId = parseSessionCookie(cookieHeader);

  if (!sessionId) {
    return null;
  }

  const sessionInfo = await verifySession(sessionId, db);
  if (!sessionInfo) {
    return null;
  }

  const businesses = await getOwnerBusinesses(sessionInfo.ownerId, db);
  if (businesses.length === 0) {
    return null;
  }

  const business = businesses[0];

  return {
    businessId: business.businessId,
    businessName: business.businessName,
    businessSlug: business.businessSlug,
    ownerId: sessionInfo.ownerId,
    sessionId: sessionInfo.sessionId
  };
}
