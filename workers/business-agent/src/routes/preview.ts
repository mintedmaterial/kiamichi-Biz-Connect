/**
 * Preview Route Handler
 * Provides authenticated preview of draft business listing pages
 */
import { PageAssembler } from '../services/page-assembler';
import { TemplateLoader } from '../services/template-loader';
import { ComponentRenderer } from '../services/component-renderer';

/**
 * Handle preview requests for business listing pages
 *
 * URL format: /preview/{businessId}
 *
 * Security:
 * - Validates portal_session cookie
 * - Verifies business ownership
 * - Only allows verified owners to preview their business pages
 *
 * @param request - Incoming HTTP request
 * @param env - Cloudflare Worker environment bindings
 * @returns HTML preview response or error
 */
export async function handlePreview(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // Extract businessId from URL path: /preview/{businessId}
  const pathParts = url.pathname.split('/');
  const businessId = pathParts[2];

  if (!businessId) {
    return new Response('Missing business ID in URL', { status: 400 });
  }

  // Parse portal_session cookie
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) {
    return new Response('Unauthorized: No session cookie', {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Cookie realm="Preview"'
      }
    });
  }

  // Extract session ID from cookies
  const sessionMatch = cookieHeader.match(/portal_session=([^;]+)/);
  if (!sessionMatch) {
    return new Response('Unauthorized: Invalid session cookie', { status: 401 });
  }

  const sessionId = sessionMatch[1];

  try {
    // Verify session in D1
    const session = await env.DB.prepare(`
      SELECT id, owner_id, expires_at, last_activity
      FROM portal_sessions
      WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return new Response('Unauthorized: Session not found', { status: 401 });
    }

    // Check if session is expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expires_at && session.expires_at < now) {
      return new Response('Unauthorized: Session expired', { status: 401 });
    }

    // Check business ownership
    const ownership = await env.DB.prepare(`
      SELECT id, owner_id, business_id, claim_status
      FROM business_ownership
      WHERE owner_id = ? AND business_id = ? AND claim_status = 'verified'
    `).bind(session.owner_id, businessId).first();

    if (!ownership) {
      return new Response('Forbidden: You do not own this business', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Get listing page for business
    const listingPage = await env.DB.prepare(`
      SELECT id FROM listing_pages
      WHERE business_id = ?
    `).bind(businessId).first();

    if (!listingPage) {
      return new Response('Not Found: No listing page exists for this business', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Use PageAssembler to render HTML in preview mode
    const templateLoader = new TemplateLoader(env.TEMPLATES);
    const componentRenderer = new ComponentRenderer();
    const pageAssembler = new PageAssembler(env.DB, templateLoader, componentRenderer);

    const assembledPage = await pageAssembler.assemblePage(String(listingPage.id), {
      previewMode: true
    });

    // Inject preview banner at the top of the body
    // The PageAssembler already adds a basic preview banner, but we'll enhance it
    const enhancedHtml = assembledPage.html.replace(
      '<body>',
      `<body>
  <div style="position: fixed; top: 0; left: 0; right: 0; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 16px; text-align: center; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.15); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: center; gap: 12px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
      <strong style="font-size: 16px; font-weight: 600;">PREVIEW MODE</strong>
      <span style="opacity: 0.9; font-size: 14px;">This is a draft preview. Changes are not yet published.</span>
    </div>
  </div>
  <div style="height: 52px;"></div>`
    );

    // Return HTML with no-cache headers
    return new Response(enhancedHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Preview error:', error);
    return new Response(`Internal Server Error: ${error}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain'
      }
    });
  }
}
