/**
 * Official Facebook Graph API Integration
 * Uses proper access tokens instead of browser automation
 *
 * Setup Instructions:
 * 1. Create Facebook App at developers.facebook.com
 * 2. Get Page Access Token from Graph API Explorer
 * 3. Set secrets: wrangler secret put FB_PAGE_ACCESS_TOKEN
 * 4. Set secrets: wrangler secret put FB_USER_ACCESS_TOKEN (optional, for user posts)
 */

export interface FacebookPostOptions {
  message: string;
  link?: string;
  imageUrl?: string;
}

export interface FacebookPostResponse {
  success: boolean;
  post_id?: string;
  error?: string;
}

/**
 * Post to Facebook Page using Official Graph API
 * Requires FB_PAGE_ACCESS_TOKEN secret
 */
export async function postToPage(
  pageId: string,
  accessToken: string,
  options: FacebookPostOptions
): Promise<FacebookPostResponse> {
  try {
    const url = `https://graph.facebook.com/v19.0/${pageId}/feed`;

    const body: any = {
      message: options.message,
      access_token: accessToken
    };

    if (options.link) {
      body.link = options.link;
    }

    // If image URL provided, use photos endpoint instead
    // NOTE: Facebook only accepts images from publicly accessible URLs (your own domain)
    // External CDN URLs (like fbcdn.net) won't work
    if (options.imageUrl) {
      // Only attempt photo upload if it's from our own domain or R2
      const isOurImage = options.imageUrl.includes('kiamichi-biz-connect') ||
                         options.imageUrl.includes('srvcflo.workers.dev') ||
                         options.imageUrl.includes('/images/');

      if (isOurImage) {
        const photoUrl = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        const photoBody = new URLSearchParams({
          message: options.message,
          url: options.imageUrl,
          access_token: accessToken
        });

        const response = await fetch(photoUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: photoBody.toString()
        });

        if (!response.ok) {
          const error = await response.json();
          console.warn('Photo upload failed, falling back to link post:', error.error?.message);
          // Fall through to regular post with link
        } else {
          const result = await response.json();
          return {
            success: true,
            post_id: result.id || result.post_id
          };
        }
      } else {
        console.log('External image URL detected, posting as link instead');
        // External image - just add it as the link if no link is provided
        if (!options.link && options.imageUrl) {
          body.link = options.imageUrl;
        }
      }
    }

    // Regular post (no image)
    const formBody = new URLSearchParams(body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Unknown error posting to page'
      };
    }

    const result = await response.json();
    return {
      success: true,
      post_id: result.id
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Post to Facebook Group using Official Graph API
 * Requires FB_USER_ACCESS_TOKEN or FB_PAGE_ACCESS_TOKEN with groups permission
 */
export async function postToGroup(
  groupId: string,
  accessToken: string,
  options: FacebookPostOptions
): Promise<FacebookPostResponse> {
  try {
    const url = `https://graph.facebook.com/v19.0/${groupId}/feed`;

    const body: any = {
      message: options.message,
      access_token: accessToken
    };

    if (options.link) {
      body.link = options.link;
    }

    const formBody = new URLSearchParams(body);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formBody.toString()
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Unknown error posting to group'
      };
    }

    const result = await response.json();
    return {
      success: true,
      post_id: result.id
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

/**
 * Get current user info (to verify token is valid)
 */
export async function getMe(accessToken: string): Promise<any> {
  try {
    const url = `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`;

    const response = await fetch(url);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get user info');
    }

    return await response.json();
  } catch (error: any) {
    throw new Error(`Failed to verify access token: ${error.message}`);
  }
}
