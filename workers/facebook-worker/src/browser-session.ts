/**
 * BrowserSession Durable Object
 *
 * Manages Facebook authentication and posting for Kiamichi Biz Connect
 * Session lifecycle:
 * - Logs into Facebook (desktop site for reliability)
 * - Stores cookies and auth tokens in Durable Object storage (persistent)
 * - Posts to profile page or group using GraphQL API or browser fallback
 * - Auto re-logins when cookies expire
 */

import puppeteer from '@cloudflare/puppeteer';
import { postViaGraphQL } from './fb-graphql-api';

/**
 * Session state stored in Durable Object
 */
interface SessionState {
  cookies: any[];
  cookieString: string;
  fb_dtsg?: string;      // CSRF token for API calls
  userId?: string;       // User ID for API calls
  lsd?: string;          // LSD token for API calls
  loginTime: number;
  expiresAt: number;
  isLoggedIn: boolean;
}

/**
 * Environment bindings for browser session
 */
interface Env {
  BROWSER: any;
  FB_EMAIL: string;
  FB_PASSWORD: string;
  SESSION_LIFETIME_HOURS: string;
  FB_PROFILE_ID: string;
  FB_GROUP_ID: string;
}

export class BrowserSession implements DurableObject {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle HTTP requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/login':
          return await this.handleLogin();

        case '/post': {
          const body = await request.json<{ message: string; target?: 'profile' | 'group' }>();
          if (!body.message) {
            return jsonResponse({ error: 'Missing message' }, 400);
          }
          return await this.handlePost(body.message, body.target || 'profile');
        }

        case '/status':
          return await this.handleStatus();

        case '/logout':
          return await this.handleLogout();

        default:
          return jsonResponse({ error: 'Not found' }, 404);
      }
    } catch (err) {
      const error = err as Error;
      console.error('[BrowserSession] Request error:', error.message);
      return jsonResponse({ error: error.message }, 500);
    }
  }

  /**
   * Login to Facebook Desktop and store cookies
   */
  private async handleLogin(): Promise<Response> {
    console.log('[BrowserSession] Starting desktop Facebook login');

    let browser;
    try {
      // Launch browser
      browser = await puppeteer.launch(this.env.BROWSER);
      const page = await browser.newPage();

      // Set desktop user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      // Set desktop viewport to match user agent
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      });

      // Navigate to Facebook desktop
      console.log('[BrowserSession] Navigating to www.facebook.com');
      await page.goto('https://www.facebook.com/', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Log HTML preview for debugging
      const htmlContent = await page.content();
      console.log('[BrowserSession] Page HTML preview:', htmlContent.substring(0, 500));

      // Email field selectors (try multiple)
      const emailSelectors = ['#email', 'input[name="email"]', 'input[type="email"]'];
      let emailField;
      for (const selector of emailSelectors) {
        try {
          emailField = await page.waitForSelector(selector, { timeout: 3000 });
          if (emailField) {
            console.log(`[BrowserSession] Found email field with: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`[BrowserSession] Email selector failed: ${selector}`);
        }
      }

      if (!emailField) {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.log('[BrowserSession] No email field screenshot:', screenshot.substring(0, 200));
        throw new Error('Could not find email input field');
      }

      // Password field selectors (try multiple)
      const passwordSelectors = ['#pass', 'input[name="pass"]', 'input[type="password"]'];
      let passwordField;
      for (const selector of passwordSelectors) {
        try {
          passwordField = await page.waitForSelector(selector, { timeout: 3000 });
          if (passwordField) {
            console.log(`[BrowserSession] Found password field with: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`[BrowserSession] Password selector failed: ${selector}`);
        }
      }

      if (!passwordField) {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.log('[BrowserSession] No password field screenshot:', screenshot.substring(0, 200));
        throw new Error('Could not find password input field');
      }

      // Fill login credentials
      console.log('[BrowserSession] Filling login form');
      await page.type('#email', this.env.FB_EMAIL, { delay: 100 });
      await page.type('#pass', this.env.FB_PASSWORD, { delay: 100 });

      // Login button selectors (try multiple - CRITICAL FIX)
      const loginButtonSelectors = [
        'button[name="login"]',        // Legacy
        'button[type="submit"]',       // Most common now
        'button[data-testid="royal_login_button"]',  // Modern Facebook
        'input[type="submit"]',        // Fallback
        'button[value="Log In"]',      // Alternative
      ];

      let loginButton;
      for (const selector of loginButtonSelectors) {
        try {
          loginButton = await page.waitForSelector(selector, { timeout: 2000 });
          if (loginButton) {
            console.log(`[BrowserSession] Found login button with: ${selector}`);
            break;
          }
        } catch (e) {
          console.log(`[BrowserSession] Login button selector failed: ${selector}`);
        }
      }

      if (!loginButton) {
        // Capture diagnostic screenshot
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.log('[BrowserSession] Login page screenshot:', screenshot.substring(0, 200));
        console.log('[BrowserSession] Page URL:', page.url());
        throw new Error('No login button found with any selector');
      }

      // Submit login
      console.log('[BrowserSession] Submitting login');
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        loginButton.click(),
      ]);

      // Check if login succeeded
      let currentUrl = page.url();
      console.log('[BrowserSession] Post-login URL:', currentUrl);

      // Handle auth_platform redirect (consent/permissions page)
      if (currentUrl.includes('/auth_platform/')) {
        console.log('[BrowserSession] Detected auth_platform redirect, waiting for redirect...');
        try {
          await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 });
          currentUrl = page.url();
          console.log('[BrowserSession] After auth redirect:', currentUrl);
        } catch (e) {
          console.log('[BrowserSession] No automatic redirect, continuing to profile page');
        }
      }

      if (currentUrl.includes('/login') || currentUrl.includes('/checkpoint')) {
        const screenshot = await page.screenshot({ encoding: 'base64' });
        console.log('[BrowserSession] Login failed screenshot:', screenshot.substring(0, 200));
        throw new Error('Login failed - check credentials or security checkpoint required');
      }

      // Navigate to profile page to ensure we get all necessary cookies and can extract tokens
      console.log('[BrowserSession] Navigating to profile page');
      await page.goto(`https://www.facebook.com/profile.php?id=${this.env.FB_PROFILE_ID}`, {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait a moment for page to fully load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract authentication tokens from page HTML
      const profileHtml = await page.content();

      // Extract CSRF token (fb_dtsg)
      const dtsgMatch = profileHtml.match(/"DTSGInitialData"[^}]*"token":"([^"]+)"/);
      const fb_dtsg = dtsgMatch ? dtsgMatch[1] : undefined;
      console.log('[BrowserSession] Extracted fb_dtsg:', fb_dtsg ? 'YES' : 'NO');

      // Extract User ID (try multiple patterns)
      let userId: string | undefined;
      const userPatterns = [
        /"USER_ID":"(\d+)"/,           // Standard format
        /"userID":"(\d+)"/,             // Alternative format
        /c_user=(\d+)/,                 // Cookie format
        /"actorID":"(\d+)"/,            // Actor ID
        /"userVanity":"(\d+)"/          // Vanity format
      ];

      for (const pattern of userPatterns) {
        const match = profileHtml.match(pattern);
        if (match && match[1] && match[1] !== '0') {
          userId = match[1];
          console.log(`[BrowserSession] Extracted userId from pattern ${pattern}:`, userId);
          break;
        }
      }

      if (!userId) {
        // Try to get from cookie
        const cUserCookie = cookies.find(c => c.name === 'c_user');
        if (cUserCookie && cUserCookie.value && cUserCookie.value !== '0') {
          userId = cUserCookie.value;
          console.log('[BrowserSession] Extracted userId from c_user cookie:', userId);
        } else {
          console.log('[BrowserSession] FAILED to extract userId - GraphQL posting will not work');
        }
      }

      // Extract LSD token (used in GraphQL API calls)
      const lsdMatch = profileHtml.match(/\["LSD",\[\],\{"token":"([^"]+)"\}/);
      const lsd = lsdMatch ? lsdMatch[1] : undefined;
      console.log('[BrowserSession] Extracted lsd:', lsd ? 'YES' : 'NO');

      // Extract cookies
      const cookies = await page.cookies();
      console.log(`[BrowserSession] Extracted ${cookies.length} cookies`);

      // Format cookies as header string
      const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

      // Store session state with tokens
      const sessionLifetime = parseInt(this.env.SESSION_LIFETIME_HOURS || '24') * 60 * 60 * 1000;
      const now = Date.now();
      const sessionState: SessionState = {
        cookies,
        cookieString,
        fb_dtsg,
        userId,
        lsd,
        loginTime: now,
        expiresAt: now + sessionLifetime,
        isLoggedIn: true,
      };

      await this.state.storage.put('session', sessionState);
      console.log(`[BrowserSession] Session stored, expires at ${new Date(sessionState.expiresAt).toISOString()}`);

      return jsonResponse({
        success: true,
        message: 'Logged in successfully',
        expiresAt: new Date(sessionState.expiresAt).toISOString(),
        cookieCount: cookies.length,
        hasTokens: !!fb_dtsg && !!userId && !!lsd,
      });

    } catch (err) {
      const error = err as Error;
      console.error('[BrowserSession] Login error:', error.message);

      // Try to capture screenshot on any error
      try {
        if (browser) {
          const pages = await browser.pages();
          if (pages.length > 0) {
            const screenshot = await pages[0].screenshot({ encoding: 'base64' });
            console.log('[BrowserSession] Error screenshot (base64):', screenshot.substring(0, 200));
          }
        }
      } catch (screenshotErr) {
        console.log('[BrowserSession] Could not capture error screenshot');
      }

      return jsonResponse({ error: error.message }, 500);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Post to Facebook profile or group via GraphQL API (preferred) or desktop browser (fallback)
   */
  private async handlePost(message: string, target: 'profile' | 'group'): Promise<Response> {
    console.log(`[BrowserSession] Starting post to ${target}: ${message.substring(0, 50)}...`);

    let browser;
    try {
      // Check session validity
      let sessionState = await this.state.storage.get<SessionState>('session');

      if (!sessionState || !sessionState.isLoggedIn || Date.now() > sessionState.expiresAt) {
        console.log('[BrowserSession] Session expired, re-logging in');
        const loginResponse = await this.handleLogin();
        const loginResult = await loginResponse.json() as any;

        if (!loginResult.success) {
          throw new Error('Failed to re-login: ' + loginResult.error);
        }

        // Reload session after login
        sessionState = await this.state.storage.get<SessionState>('session');
        if (!sessionState) {
          throw new Error('No session after login');
        }
      }

      // Use GraphQL API for posting (required tokens: fb_dtsg, userId)
      if (!sessionState.fb_dtsg || !sessionState.userId) {
        return jsonResponse({
          success: false,
          error: 'Missing authentication tokens. Session may need re-login.',
          details: {
            has_fb_dtsg: !!sessionState.fb_dtsg,
            has_userId: !!sessionState.userId,
            has_lsd: !!sessionState.lsd
          }
        }, 500);
      }

      console.log('[BrowserSession] Posting via GraphQL API');
      const graphqlResult = await postViaGraphQL(message, target, sessionState, this.env);

      if (graphqlResult.success) {
        console.log(`[BrowserSession] Successfully posted via GraphQL API, post_id: ${graphqlResult.post_id}`);
        return jsonResponse({
          success: true,
          target,
          method: 'graphql',
          post_id: graphqlResult.post_id,
          message: `Posted successfully to ${target} via GraphQL API`,
        });
      } else {
        console.error(`[BrowserSession] GraphQL API failed: ${graphqlResult.error}`);
        return jsonResponse({
          success: false,
          error: graphqlResult.error,
          method: 'graphql',
          target
        }, 500);
      }
    } catch (err) {
      const error = err as Error;
      console.error(`[BrowserSession] Post error:`, error.message);
      return jsonResponse({ error: error.message, target }, 500);
    }
  }

  /**
   * Get session status
   */
  private async handleStatus(): Promise<Response> {
    const sessionState = await this.state.storage.get<SessionState>('session');

    if (!sessionState) {
      return jsonResponse({
        isLoggedIn: false,
        message: 'No session found',
      });
    }

    const now = Date.now();
    const isExpired = now > sessionState.expiresAt;

    return jsonResponse({
      isLoggedIn: sessionState.isLoggedIn && !isExpired,
      loginTime: new Date(sessionState.loginTime).toISOString(),
      expiresAt: new Date(sessionState.expiresAt).toISOString(),
      isExpired,
      timeRemaining: isExpired ? 0 : Math.floor((sessionState.expiresAt - now) / 1000 / 60), // Minutes
    });
  }

  /**
   * Logout and clear session
   */
  private async handleLogout(): Promise<Response> {
    await this.state.storage.delete('session');
    console.log('[BrowserSession] Session cleared');

    return jsonResponse({
      success: true,
      message: 'Logged out successfully',
    });
  }
}

/**
 * Helper to return JSON response
 */
function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
