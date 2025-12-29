/**
 * Facebook OAuth 2.0 Integration
 * Handles login flow for both users (auto-fill) and admin (posting automation)
 */

import { Env } from './types';

export interface FacebookTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id?: string;
}

export interface FacebookPageInfo {
  id: string;
  name: string;
  about?: string;
  phone?: string;
  emails?: string[];
  website?: string;
  location?: {
    city?: string;
    state?: string;
    street?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
  };
  cover?: {
    source: string;
  };
  picture?: {
    data: {
      url: string;
    };
  };
  rating_count?: number;
  overall_star_rating?: number;
  category?: string;
}

/**
 * Generate Facebook OAuth login URL
 * @param env Environment with FB_APP_ID and SITE_URL
 * @param redirectUri Where to redirect after login
 * @param state Random state parameter for CSRF protection
 * @param scope Permissions to request
 */
export function getFacebookLoginUrl(
  env: Env,
  redirectUri: string,
  state: string,
  scope: string = 'public_profile,email,pages_read_engagement,pages_manage_posts'
): string {
  const params = new URLSearchParams({
    client_id: env.FB_APP_ID as string,
    redirect_uri: redirectUri,
    state,
    scope,
    response_type: 'code'
  });

  return `https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 * @param code Authorization code from callback
 * @param env Environment with FB_APP_ID and FB_APP_SECRET
 * @param redirectUri Must match the one used in login URL
 */
export async function exchangeCodeForToken(
  code: string,
  env: Env,
  redirectUri: string
): Promise<FacebookTokens> {
  const params = new URLSearchParams({
    client_id: env.FB_APP_ID as string,
    client_secret: env.FB_APP_SECRET as string,
    redirect_uri: redirectUri,
    code
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * Exchange short-lived token for long-lived token (60 days)
 * @param shortLivedToken Short-lived access token
 * @param env Environment with FB_APP_ID and FB_APP_SECRET
 */
export async function extendAccessToken(
  shortLivedToken: string,
  env: Env
): Promise<{ access_token: string; token_type: string; expires_in: number }> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: env.FB_APP_ID as string,
    client_secret: env.FB_APP_SECRET as string,
    fb_exchange_token: shortLivedToken
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/oauth/access_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to extend access token: ${error}`);
  }

  return await response.json();
}

/**
 * Debug token to check expiration and validity
 * @param accessToken Token to debug
 * @param appAccessToken App access token (app_id|app_secret)
 */
export async function debugAccessToken(
  accessToken: string,
  appAccessToken: string
): Promise<any> {
  const params = new URLSearchParams({
    input_token: accessToken,
    access_token: appAccessToken
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/debug_token?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to debug token: ${error}`);
  }

  return await response.json();
}

/**
 * Get user's Facebook pages (businesses they manage)
 * @param accessToken User access token
 */
export async function getUserPages(accessToken: string): Promise<any[]> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch user pages: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Get detailed information about a Facebook page
 * @param pageId Facebook page ID
 * @param accessToken Access token (user or page token)
 */
export async function getPageInfo(
  pageId: string,
  accessToken: string
): Promise<FacebookPageInfo> {
  const fields = [
    'id',
    'name',
    'about',
    'phone',
    'emails',
    'website',
    'location',
    'cover',
    'picture{url}',
    'rating_count',
    'overall_star_rating',
    'category'
  ].join(',');

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}?fields=${fields}&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch page info: ${error}`);
  }

  return await response.json();
}

/**
 * Post to a Facebook page
 * @param pageId Facebook page ID
 * @param pageAccessToken Page access token (not user token)
 * @param message Post message
 * @param link Optional link to include
 */
export async function postToPage(
  pageId: string,
  pageAccessToken: string,
  message: string,
  link?: string
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    message,
    access_token: pageAccessToken
  });

  if (link) {
    params.set('link', link);
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/feed`,
    {
      method: 'POST',
      body: params
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post to page: ${error}`);
  }

  return await response.json();
}

/**
 * Post to a Facebook group
 * @param groupId Facebook group ID
 * @param accessToken Access token with groups_access_member_info permission
 * @param message Post message
 * @param link Optional link to include
 */
export async function postToGroup(
  groupId: string,
  accessToken: string,
  message: string,
  link?: string
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    message,
    access_token: accessToken
  });

  if (link) {
    params.set('link', link);
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${groupId}/feed`,
    {
      method: 'POST',
      body: params
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to post to group: ${error}`);
  }

  return await response.json();
}

/**
 * Search for a business on Facebook by name
 * @param businessName Name to search for
 * @param accessToken Access token
 */
export async function searchBusinessPages(
  businessName: string,
  accessToken: string
): Promise<any[]> {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/pages/search?q=${encodeURIComponent(businessName)}&type=page&access_token=${accessToken}`
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to search pages: ${error}`);
  }

  const data = await response.json();
  return data.data || [];
}

/**
 * Store Facebook tokens in KV namespace
 * @param env Environment with CACHE KV namespace
 * @param userId Unique identifier for the user
 * @param tokens Facebook tokens to store
 * @param expirationTtl TTL in seconds (default 60 days)
 */
export async function storeTokens(
  env: Env,
  userId: string,
  tokens: FacebookTokens,
  expirationTtl: number = 60 * 60 * 24 * 60 // 60 days
): Promise<void> {
  const key = `fb_token:${userId}`;
  await env.CACHE.put(key, JSON.stringify(tokens), {
    expirationTtl
  });
}

/**
 * Retrieve Facebook tokens from KV namespace
 * @param env Environment with CACHE KV namespace
 * @param userId Unique identifier for the user
 */
export async function getStoredTokens(
  env: Env,
  userId: string
): Promise<FacebookTokens | null> {
  const key = `fb_token:${userId}`;
  const stored = await env.CACHE.get(key);

  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

/**
 * Get posts from a Facebook page
 * @param pageId Facebook page ID
 * @param accessToken Access token
 * @param limit Number of posts to fetch (default 10)
 */
export async function getPagePosts(
  pageId: string,
  accessToken: string,
  limit: number = 10
): Promise<any[]> {
  const fields = 'id,message,created_time,permalink_url,reactions.summary(true),comments.summary(true),shares';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/posts?fields=${fields}&limit=${limit}&access_token=${accessToken}`,
      { signal: controller.signal }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch posts: ${error}`);
    }

    const data = await response.json();
    return data.data || [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate Facebook post embed code
 * @param postUrl Full URL to the Facebook post
 * @param width Width of the embed (default 500)
 */
export function generatePostEmbedCode(postUrl: string, width: number = 500): string {
  const encodedUrl = encodeURIComponent(postUrl);
  return `<iframe src="https://www.facebook.com/plugins/post.php?href=${encodedUrl}&width=${width}&show_text=true" width="${width}" height="500" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>`;
}

/**
 * Extract page ID from Facebook URL
 * @param facebookUrl Facebook page URL
 * @param accessToken Access token
 */
export async function extractPageIdFromUrl(
  facebookUrl: string,
  accessToken: string
): Promise<string | null> {
  try {
    const urlMatch = facebookUrl.match(/facebook\.com\/([^/?]+)/);
    if (!urlMatch) return null;

    const username = urlMatch[1];
    if (/^\d+$/.test(username)) return username;

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${username}?fields=id&access_token=${accessToken}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.id || null;
  } catch {
    return null;
  }
}

/**
 * Check rate limit using KV
 * @param env Environment with CACHE KV namespace
 * @param key Rate limit key
 * @returns true if rate limit exceeded
 */
export async function checkRateLimit(env: Env, key: string): Promise<boolean> {
  const rateLimitKey = `ratelimit:${key}`;
  const current = await env.CACHE.get(rateLimitKey);
  const count = current ? parseInt(current) : 0;

  if (count >= 200) return true;

  await env.CACHE.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 });
  return false;
}
