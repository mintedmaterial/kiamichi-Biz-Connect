// Independent Cloudflare Worker for posting to the Kiamichi Facebook Group
// - Uses the same D1 database as the main site (binding: DB)
// - Expects secrets set via `wrangler secret put FB_ACCESS_TOKEN` and `wrangler secret put FB_GROUP_ID`

import {
  getPagePosts,
  getPageInfo,
  extractPageIdFromUrl,
  generatePostEmbedCode,
  checkRateLimit,
} from '../../../src/facebook-oauth';
import { selectTopPosts, calculateVerificationScore } from '../../../src/facebook-ai-analyzer';
import { populateContentQueue, getQueueStatus, getAnalyticsSummary } from '../../../src/facebook-scheduler';
import type { FacebookContentQueue } from '../../../src/types';
import { postToPage as officialPostToPage, postToGroup as officialPostToGroup } from './fb-official-api';
import { processComments } from '../../../src/facebook-comment-monitor';

// Export BrowserSession Durable Object
export { BrowserSession } from './browser-session';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // DEBUG: Manually trigger Facebook login via BrowserSession
      if (path === '/browser-login') {
        try {
          const id = env.BROWSER_SESSION.idFromName('facebook-session');
          const stub = env.BROWSER_SESSION.get(id);
          const response = await stub.fetch('https://dummy/login', { method: 'POST' });
          const result = await response.json();
          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Refresh Facebook Page Access Token (extends to 60 days)
      if (path === '/refresh-token') {
        try {
          const currentToken = env.FB_PAGE_ACCESS_TOKEN;

          if (!currentToken) {
            return new Response(JSON.stringify({
              success: false,
              error: 'No current token to refresh'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Import token extension function
          const { extendAccessToken, debugAccessToken } = await import('../../../src/facebook-oauth');

          // First debug the current token to check its status
          const appAccessToken = `${env.FB_APP_ID}|${env.FB_APP_SECRET}`;

          let debugInfo;
          try {
            debugInfo = await debugAccessToken(currentToken, appAccessToken);
            console.log('[Token Refresh] Current token debug:', debugInfo);
          } catch (debugError: any) {
            console.warn('[Token Refresh] Could not debug token:', debugError.message);
          }

          // Extend the token to 60 days
          const extendedTokenResponse = await extendAccessToken(currentToken, env);

          console.log('[Token Refresh] Token extended successfully');
          console.log('[Token Refresh] Expires in:', extendedTokenResponse.expires_in, 'seconds');
          console.log('[Token Refresh] Expires in days:', Math.floor(extendedTokenResponse.expires_in / 86400));

          // TODO: Automatically update the secret with the new token
          // For now, return it so it can be manually updated if needed

          return new Response(JSON.stringify({
            success: true,
            message: 'Token extended successfully',
            new_token: extendedTokenResponse.access_token,
            expires_in_seconds: extendedTokenResponse.expires_in,
            expires_in_days: Math.floor(extendedTokenResponse.expires_in / 86400),
            current_token_debug: debugInfo,
            note: 'Token extended! This token will expire in ~60 days. The system will auto-refresh it before expiration.'
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('[Token Refresh] Error:', error.message);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // DEBUG: Check BrowserSession status
      if (path === '/browser-status') {
        try {
          const id = env.BROWSER_SESSION.idFromName('facebook-session');
          const stub = env.BROWSER_SESSION.get(id);
          const response = await stub.fetch('https://dummy/status');
          const result = await response.json();
          return new Response(JSON.stringify(result, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Post to Facebook using Official Graph API
      if (path === '/post') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

        try {
          const body = await request.json();
          const { message, link, image_url, target } = body;

          if (!message) {
            return new Response(JSON.stringify({ error: 'Missing message' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          console.log('[Official API] Posting to Facebook');

          const pageId = env.FB_PAGE_ID;
          const pageToken = env.FB_PAGE_ACCESS_TOKEN;
          const groupId = env.FB_GROUP_ID;
          const groupToken = env.FB_ACCESS_TOKEN || env.FB_PAGE_ACCESS_TOKEN;

          let pagePostId: string | null = null;
          let groupPostId: string | null = null;
          const errors: string[] = [];

          // Determine target (default to page if not specified)
          const targetType = target || 'page';

          // Post to Page if needed (using Official Graph API)
          if ((targetType === 'page' || targetType === 'both') && pageId && pageToken) {
            console.log(`[Official API] Posting to Page ${pageId}`);
            const pageResponse = await officialPostToPage(pageId, pageToken, {
              message,
              link: link || undefined,
              imageUrl: image_url || undefined
            });

            if (pageResponse.success) {
              pagePostId = pageResponse.post_id || null;
              console.log(`[Official API] Page post successful: ${pagePostId}`);
            } else {
              console.error('[Official API] Page post failed:', pageResponse.error);
              errors.push(`Page: ${pageResponse.error}`);
            }
          }

          // Rate limit between posts
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Post to Group if needed (using Official Graph API)
          if ((targetType === 'group' || targetType === 'both') && groupId && groupToken) {
            console.log(`[Official API] Posting to Group ${groupId}`);
            const groupResponse = await officialPostToGroup(groupId, groupToken, {
              message,
              link: link || undefined
            });

            if (groupResponse.success) {
              groupPostId = groupResponse.post_id || null;
              console.log(`[Official API] Group post successful: ${groupPostId}`);
            } else {
              console.error('[Official API] Group post failed:', groupResponse.error);
              errors.push(`Group: ${groupResponse.error}`);
            }
          }

          return new Response(JSON.stringify({
            success: !!(pagePostId || groupPostId),
            pagePostId,
            groupPostId,
            errors: errors.length > 0 ? errors : undefined
          }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('Post error:', err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Trigger queue processing (for on-demand posts from business agent)
      if (path === '/trigger-queue') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

        try {
          console.log('[TRIGGER] Processing queue on-demand...');

          const now = Math.floor(Date.now() / 1000);

          // Process pending posts using the SAME mechanism that was working
          const result = await processPendingPostsInternal(env, now);

          console.log('[TRIGGER] Queue processing complete:', result);

          return new Response(JSON.stringify({
            success: true,
            posted: result.posted || 0,
            failed: result.failed || 0,
            pagePostId: result.pagePostId,
            groupPostId: result.groupPostId,
            message: 'Queue processed successfully'
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (error: any) {
          console.error('[TRIGGER] Error processing queue:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error.message
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Test endpoint: Generate AI content and post
      if (path === '/test-post') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

        try {
          const { business_id, force_image } = await request.json().catch(() => ({ business_id: null, force_image: false }));

          // Get a business to spotlight (either specified or random featured)
          const db = env.DB;
          let business;

          if (business_id) {
            business = await db.prepare('SELECT * FROM businesses WHERE id = ?').bind(business_id).first();
          } else {
            business = await db.prepare('SELECT * FROM businesses WHERE is_featured = 1 AND is_active = 1 ORDER BY RANDOM() LIMIT 1').first();
          }

          if (!business) {
            return new Response(JSON.stringify({ error: 'No business found for test post' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          console.log(`[Test] Generating post for: ${business.name}`);

          // STEP 1: Generate content with real Workers AI
          console.log('[Test] Step 1: Generating AI content...');

          const systemPrompt = `You are a friendly, enthusiastic local community member in Southeast Oklahoma who loves supporting local businesses and sharing discoveries with friends.

PERSONALITY:
- Warm, genuine, and conversational (like texting a friend)
- Use contractions naturally (we're, they're, can't, won't, you'll)
- Vary your tone: sometimes excited (!), sometimes thoughtful, sometimes curious (?)
- Show real emotion - gratitude, excitement, appreciation
- Sound like a real person, NOT a marketer

WRITING STYLE:
- Keep it brief: 60-120 words max
- Start with a hook that feels natural ("Just found...", "Y'all...", "Okay so...", "Can we talk about...")
- Use casual language and local flavor
- NO hashtags, NO emoji spam, NO corporate buzzwords
- Add personal touches ("seriously", "honestly", "I'm telling you")
${business.facebook_url
  ? `- IMPORTANT: Tag the business using @${business.name.replace(/\s+/g, '')} (remove ALL spaces!) - they have a Facebook page and you follow them!
- Example: @${business.name.replace(/\s+/g, '')} (no spaces allowed in tags!)`
  : '- Mention the business by name, but DON\'T use @tag (they don\'t have a Facebook page)'
}

Remember: You're NOT selling, you're SHARING something cool you found. Sound human!`;

          const userPrompt = `Share about this awesome local business you discovered:

Business: ${business.name}
Where: ${business.city}, ${business.state}
What they do: ${business.description || 'Local business serving our community'}
${business.google_rating ? `They've got ${business.google_rating} stars from ${business.google_review_count} reviews` : ''}

Write like you're genuinely excited to tell people about this place. Start with something that grabbed your attention about them. Keep it real and conversational.

${business.facebook_url
  ? `IMPORTANT: Tag the business by writing @${business.name.replace(/\s+/g, '')} (remove ALL spaces from the name!) somewhere naturally. They're on Facebook!`
  : `Mention ${business.name} naturally but DON'T use @tag since they don't have a Facebook page.`
}

Around 80-100 words.`;

          const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 200,
            temperature: 0.9
          });

          let message = ((aiResponse as any).response || '').trim().replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
          // Use production domain
          const siteUrl = env.SITE_URL || 'https://kiamichibizconnect.com';
          const link = `${siteUrl}/business/${business.slug}?utm_source=facebook&utm_medium=page&utm_campaign=test_post`;

          console.log('[Test] Generated message:', message.substring(0, 150) + '...');

          // STEP 2: Generate image with Flux 2 Dev (if force_image is true)
          let imageUrl: string | undefined;

          if (force_image || Math.random() < 0.3) { // 30% chance or forced
            console.log('[Test] Step 2: Generating AI image with Flux 2 Dev...');

            try {
              // Generate business-specific imagery based on category/type
              const businessType = (business.description || '').toLowerCase();

              let sceneDescription = '';
              if (businessType.includes('electric') || businessType.includes('electrician')) {
                sceneDescription = 'Professional electrician working on an electrical panel in a modern home, wearing safety gear, organized tools visible, bright workshop lighting, focusing on the electrical work';
              } else if (businessType.includes('plumb')) {
                sceneDescription = 'Skilled plumber repairing pipes under a sink, professional tools laid out neatly, clean modern bathroom setting, natural lighting';
              } else if (businessType.includes('hair') || businessType.includes('salon') || businessType.includes('beauty')) {
                sceneDescription = 'Professional hair stylist cutting client hair in modern salon, bright natural lighting, clean contemporary interior, styling tools visible';
              } else if (businessType.includes('restaurant') || businessType.includes('diner') || businessType.includes('cafe') || businessType.includes('food')) {
                sceneDescription = 'Delicious plated food in a cozy restaurant setting, warm ambient lighting, inviting atmosphere, fresh ingredients visible';
              } else if (businessType.includes('auto') || businessType.includes('mechanic') || businessType.includes('repair')) {
                sceneDescription = 'Professional mechanic working on a car engine in a clean modern auto shop, tools organized, bright overhead lighting';
              } else if (businessType.includes('fitness') || businessType.includes('gym') || businessType.includes('training')) {
                sceneDescription = 'Modern fitness equipment in a clean, bright gym space, motivational atmosphere, natural lighting through large windows';
              } else if (businessType.includes('clean')) {
                sceneDescription = 'Professional cleaning service in action, spotless modern interior, cleaning supplies organized, bright natural lighting';
              } else if (businessType.includes('landscap') || businessType.includes('lawn')) {
                sceneDescription = 'Beautiful landscaped yard with lush green grass, neat flower beds, professional landscaping tools, bright sunny day';
              } else if (businessType.includes('real estate') || businessType.includes('realty')) {
                sceneDescription = 'Beautiful modern home exterior with welcoming front entrance, well-maintained lawn, bright sunny day, professional real estate photography';
              } else if (businessType.includes('web') || businessType.includes('marketing') || businessType.includes('design')) {
                sceneDescription = 'Modern workspace with laptop displaying creative website design, clean minimalist office, natural lighting, professional creative environment';
              } else {
                sceneDescription = 'Professional business storefront in small town Oklahoma, welcoming entrance, clean modern aesthetic, bright natural daylight';
              }

              const imagePrompt = `High-quality professional business photography: ${sceneDescription}

Business: ${business.name}
Location: ${business.city}, Oklahoma

Style requirements:
- Photorealistic, professional stock photography quality
- Bright, natural lighting with warm tones
- Sharp focus, high resolution (1024x1024)
- Clean, modern, inviting atmosphere
- NO text overlays, NO watermarks
- NO people's faces visible (back of head or silhouettes only)
- Authentic business environment
- Professional color grading

Optional: Subtle business name "${business.name}" on signage or equipment in natural context.

The image should look like authentic professional business photography, NOT a social media mockup or screenshot.`;

              console.log('[Test] Image prompt:', imagePrompt.substring(0, 100) + '...');

              // Create FormData for Flux 2 Dev
              const form = new FormData();
              form.append('prompt', imagePrompt);
              form.append('width', '1024');
              form.append('height', '1024');

              const formRequest = new Request('http://dummy', {
                method: 'POST',
                body: form
              });
              const formStream = formRequest.body;
              const formContentType = formRequest.headers.get('content-type') || 'multipart/form-data';

              // Call Flux 2 Dev
              const imageResponse = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
                multipart: {
                  body: formStream,
                  contentType: formContentType
                }
              });

              const imageBase64 = (imageResponse as any).image;
              if (imageBase64) {
                // Convert and upload to R2
                const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));
                const timestamp = Date.now();
                const imageKey = `social/${business.slug}-${timestamp}.png`;

                await env.IMAGES.put(imageKey, imageBuffer, {
                  httpMetadata: { contentType: 'image/png' },
                  customMetadata: {
                    business_id: business.id.toString(),
                    business_name: business.name,
                    generated_at: timestamp.toString(),
                    type: 'facebook_test_post'
                  }
                });

                // Use production domain for image URL
                imageUrl = `${siteUrl}/images/${imageKey}`;

                // Store in D1 social_media_images table for reuse
                try {
                  await db.prepare(`
                    INSERT INTO social_media_images
                    (image_key, image_url, image_prompt, business_id, content_type, platform,
                     generated_at, model, width, height, is_approved, quality_score)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 85)
                  `).bind(
                    imageKey,
                    imageUrl,
                    imagePrompt.substring(0, 500),
                    business.id,
                    'post',
                    'facebook',
                    timestamp,
                    'flux-2-dev',
                    1024,
                    1024
                  ).run();

                  console.log('[Test] Image stored in D1 for reuse');
                } catch (dbError) {
                  console.warn('[Test] Failed to store image in D1:', dbError);
                  // Continue anyway - image is in R2
                }

                console.log('[Test] Image generated and uploaded:', imageUrl);
              }
            } catch (imgError) {
              console.error('[Test] Image generation failed:', imgError);
              // Continue without image
            }
          } else {
            console.log('[Test] Skipping image generation (not forced, business has existing image)');
            imageUrl = business.image_url || undefined;
          }

          const generated = { message, link, imageUrl };

          console.log('[Test] Content ready:', {
            message_preview: generated.message.substring(0, 100) + '...',
            link: generated.link,
            hasImage: !!generated.imageUrl,
            imageUrl: generated.imageUrl
          });

          // STEP 3: Post to Facebook using Official Graph API
          console.log('[Test] Step 3: Posting to Facebook via Official API...');

          const pageToken = env.FB_PAGE_ACCESS_TOKEN;
          const pageId = env.FB_PAGE_ID;

          if (!pageToken || !pageId) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Missing FB_PAGE_ACCESS_TOKEN or FB_PAGE_ID',
              generated_content: generated
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          const postResult = await officialPostToPage(pageId, pageToken, {
            message: generated.message,
            link: generated.link,
            imageUrl: generated.imageUrl
          });

          if (postResult.success) {
            console.log(`[Test] Successfully posted: ${postResult.post_id}`);
            return new Response(JSON.stringify({
              success: true,
              post_id: postResult.post_id,
              business_name: business.name,
              generated_message: generated.message,
              generated_link: generated.link,
              generated_image: generated.imageUrl,
              facebook_url: `https://facebook.com/${postResult.post_id.replace('_', '/posts/')}`
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: postResult.error,
              generated_content: generated
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

        } catch (err: any) {
          console.error('[Test] Error:', err);
          return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Browser-based posting endpoint (uses BrowserSession DO)
      if (path === '/post-browser') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

        try {
          const body = await request.json();
          const { message, target } = body;

          if (!message) {
            return new Response(JSON.stringify({ error: 'Missing message' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            });
          }

          // Get BrowserSession DO
          const sessionId = env.BROWSER_SESSION.idFromName('facebook-session');
          const sessionStub = env.BROWSER_SESSION.get(sessionId);

          // Post using browser automation
          const response = await sessionStub.fetch('https://do/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, target: target || 'profile' })
          });

          const result = await response.json();
          return new Response(JSON.stringify(result), {
            status: response.status,
            headers: { 'Content-Type': 'application/json' }
          });
        } catch (err: any) {
          console.error('Browser post error:', err);
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Browser session management endpoints
      if (path === '/session/status') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
        const sessionId = env.BROWSER_SESSION.idFromName('facebook-session');
        const sessionStub = env.BROWSER_SESSION.get(sessionId);
        return await sessionStub.fetch('https://do/status');
      }

      if (path === '/session/login') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        const sessionId = env.BROWSER_SESSION.idFromName('facebook-session');
        const sessionStub = env.BROWSER_SESSION.get(sessionId);
        return await sessionStub.fetch('https://do/login', { method: 'POST' });
      }

      if (path === '/session/logout') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        const sessionId = env.BROWSER_SESSION.idFromName('facebook-session');
        const sessionStub = env.BROWSER_SESSION.get(sessionId);
        return await sessionStub.fetch('https://do/logout', { method: 'POST' });
      }

      if (path === '/enrich-facebook') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        const { business_id } = await request.json().catch(() => ({}));
        if (!business_id) return new Response('Missing business_id', { status: 400 });

        const result = await enrichSingleBusiness(env, business_id);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path === '/run') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        let payload: any = {};
        try { payload = await request.json(); } catch (_) { payload = {}; }
        const res = await runOnce(env, { test: payload.test === true });
        return new Response(JSON.stringify(res), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      if (path === '/webhooks/facebook') {
        // Verification for GET
        if (request.method === 'GET') {
          const mode = url.searchParams.get('hub.mode');
          const challenge = url.searchParams.get('hub.challenge');
          const token = url.searchParams.get('hub.verify_token');
          if (mode === 'subscribe' && challenge) return new Response(challenge, { status: 200 });
          return new Response('Bad Request', { status: 400 });
        }

        // POST payloads
        if (request.method === 'POST') {
          try {
            const body = await request.json();
            // TODO: handle webhook events (new member posts, messages, etc.)
            console.log('Facebook webhook received', body);
            return new Response('OK', { status: 200 });
          } catch (err) {
            console.error('Failed to parse webhook body', err);
            return new Response('Bad Request', { status: 400 });
          }
        }

        return new Response('Method Not Allowed', { status: 405 });
      }

      // Queue status endpoint
      if (path === '/queue/status') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
        const queueItems = await getQueueStatus(env, 20);
        return new Response(JSON.stringify({
          count: queueItems.length,
          items: queueItems
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Analytics summary endpoint
      if (path === '/analytics/summary') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
        const summary = await getAnalyticsSummary(env);
        return new Response(JSON.stringify({
          period: 'last_30_days',
          summary
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Schedule preview endpoint
      if (path === '/schedule/preview') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
        const db = env.DB;
        const schedules = await db.prepare(`
          SELECT * FROM facebook_posting_schedule
          WHERE is_active = 1
          ORDER BY hour_utc, minute
        `).all();

        return new Response(JSON.stringify({
          schedules: schedules.results
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Data deletion callback required by Facebook App Review
      if (path === '/data-deletion') {
        if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
        try {
          const body = await request.json().catch(() => ({}));
          // Facebook may POST a JSON object that includes a user identifier.
          const userId = (body && (body.user_id || body.id)) || null;

          // Create a confirmation code and store request in KV for status checks
          const confirmationCode = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const origin = new URL(request.url).origin;
          const statusUrl = `${origin}/data-deletion/status?code=${confirmationCode}`;

          // Store minimal record in KV (keyed by confirmation code)
          const record = {
            user_id: userId,
            payload: body,
            status: 'pending',
            created_at: Date.now()
          };

          try {
            if (env.CACHE && typeof env.CACHE.put === 'function') {
              await env.CACHE.put(`fb_data_deletion:${confirmationCode}`, JSON.stringify(record), { expirationTtl: 60 * 60 * 24 * 30 });
            }
          } catch (kvErr) {
            console.error('KV put failed for data-deletion:', kvErr);
          }

          const resp = {
            url: statusUrl,
            confirmation_code: confirmationCode
          };

          return new Response(JSON.stringify(resp), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          console.error('data-deletion handler error', err);
          return new Response('Bad Request', { status: 400 });
        }
      }

      if (path === '/data-deletion/status') {
        if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
        const code = new URL(request.url).searchParams.get('code');
        if (!code) return new Response('Missing code', { status: 400 });

        try {
          let record: any = null;
          if (env.CACHE && typeof env.CACHE.get === 'function') {
            const raw = await env.CACHE.get(`fb_data_deletion:${code}`);
            if (raw) record = JSON.parse(raw as string);
          }

          if (!record) return new Response(JSON.stringify({ status: 'not_found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

          return new Response(JSON.stringify({ status: record.status || 'pending', created_at: record.created_at || null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (err) {
          console.error('data-deletion status error', err);
          return new Response('Internal Error', { status: 500 });
        }
      }

      return new Response('Not Found', { status: 404 });
    } catch (err: any) {
      console.error('Worker error', err);
      return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },

  // Scheduled handler — runs at specific times via cron
  // Posts at: 3 AM UTC (9 PM CST), 3 PM UTC (9 AM CST), 10 PM UTC (4 PM CST)
  // Token refresh at: 2 PM UTC (8 AM CST) - before first post
  // Analytics at: 2 AM UTC
  async scheduled(controller: any, env: any) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const currentHour = new Date().getUTCHours();
      const isPostingHour = [3, 15, 22].includes(currentHour);
      const isTokenRefreshHour = currentHour === 14;
      const isAnalyticsHour = currentHour === 2;

      console.log(`Scheduled run starting at ${new Date().toISOString()} (Hour: ${currentHour} UTC)`);
      console.log(`Is posting hour: ${isPostingHour}, Is token refresh hour: ${isTokenRefreshHour}, Is analytics hour: ${isAnalyticsHour}`);

      // TOKEN REFRESH: 2 PM UTC (8 AM CST) daily before first post
      if (isTokenRefreshHour) {
        console.log('[Token] Running daily token refresh...');
        try {
          const { extendAccessToken } = await import('../../../src/facebook-oauth');
          const currentToken = env.FB_PAGE_ACCESS_TOKEN;

          if (currentToken) {
            const extendedTokenResponse = await extendAccessToken(currentToken, env);
            const expiresInDays = Math.floor(extendedTokenResponse.expires_in / 86400);

            console.log(`[Token] ✓ Token extended successfully! Valid for ${expiresInDays} days`);
            console.log(`[Token] New token: ${extendedTokenResponse.access_token.substring(0, 20)}...`);
            console.log(`[Token] NOTE: Token has been extended but secret must be updated manually`);

            // TODO: Implement automatic secret update via Cloudflare API
            // For now, log the new token so it can be updated manually if needed
          } else {
            console.error('[Token] ✗ No token found to refresh');
          }
        } catch (tokenError: any) {
          console.error('[Token] ✗ Token refresh failed:', tokenError.message);
          // Continue with posting even if token refresh fails
        }
      }

      // POSTING TIMES: 3 AM, 3 PM, 10 PM UTC (9 PM, 9 AM, 4 PM CST)
      if (isPostingHour) {
        console.log('[Posting] This is a posting hour - processing content queue');

        // 1. Populate queue for next 24 hours (ensures we always have content)
        const queueResult = await populateContentQueue(env);
        console.log(`[Queue] Created: ${queueResult.created}, Skipped: ${queueResult.skipped}`);

        // 2. Process posts scheduled for now (±5 minute window)
        const postingResult = await processPendingPostsInternal(env, now);
        console.log(`[Posting] Success: ${postingResult.posted}, Failed: ${postingResult.failed}`);

        // 3. Monitor and respond to comments after posting
        console.log('[Comments] Running comment monitoring');
        await monitorAndRespondToComments(env);
      } else {
        console.log('[Posting] Not a posting hour - skipping post processing');
      }

      // ANALYTICS HOUR: 2 AM UTC only
      if (isAnalyticsHour) {
        console.log('[Analytics] Running 2 AM tasks: analytics update and business enrichment');
        await updatePostAnalytics(env);
        await enrichAllBusinesses(env);
      }

      console.log('Scheduled run completed successfully');
    } catch (err) {
      console.error('Scheduled run failed', err);
    }
  }
};

async function runOnce(env: any, opts: { test?: boolean } = {}) {
  const groupId = env.FB_GROUP_ID || (await getSecretPlaceholder('FB_GROUP_ID'));
  const token = env.FB_ACCESS_TOKEN || (await getSecretPlaceholder('FB_ACCESS_TOKEN'));
  if (!groupId || !token) {
    console.error('Missing FB_GROUP_ID or FB_ACCESS_TOKEN');
    throw new Error('Facebook credentials not configured. Use `wrangler secret put` to set them.');
  }

  // Try to fetch a featured business from D1
  const db: any = env.DB;
  let message = '';
  let link = env.SITE_URL || '';

  try {
    const feat = await db.prepare(`SELECT * FROM businesses WHERE is_featured = 1 AND is_active = 1 ORDER BY google_rating DESC, name LIMIT 1`).first();
    if (feat) {
      message = `${feat.name} — ${feat.description ? feat.description.substring(0, 200) : ''}`;
      link = `${env.SITE_URL}/business/${feat.slug}?utm_source=facebook&utm_medium=group&utm_campaign=highlight`;
    } else {
      const post = await db.prepare(`SELECT * FROM blog_posts WHERE is_published = 1 ORDER BY publish_date DESC LIMIT 1`).first();
      if (post) {
        message = `${post.title}\n\n${post.excerpt || (post.content ? post.content.substring(0,200) : '')}`;
        link = `${env.SITE_URL}/blog/${post.slug}?utm_source=facebook&utm_medium=group&utm_campaign=blog_share`;
      } else {
        message = `Kiamichi Biz Connect is live! Add your business: ${env.SITE_URL}`;
      }
    }

    if (opts.test) message = `[TEST] ${message}`;

    const params = new URLSearchParams();
    params.set('message', message);
    params.set('link', link);
    params.set('access_token', token);

    const res = await fetch(`https://graph.facebook.com/${groupId}/feed`, { method: 'POST', body: params });
    const data = await res.json();
    console.log('Posted to Facebook', data);
    return data;
  } catch (err) {
    console.error('runOnce error', err);
    throw err;
  }
}

// Helper placeholder to indicate secrets should be set via wrangler. In worker runtime
// secrets will be injected into `env`; this function is only a helpful message for local runs.
async function getSecretPlaceholder(name: string) {
  return undefined;
}

/**
 * Process pending posts scheduled for now (±5 minute window)
 */
/**
 * Helper function to post via BrowserSession Durable Object
 * Auto-logins and maintains session - no manual token management needed!
 */
async function postViaBrowserSession(
  env: any,
  message: string,
  target: 'profile' | 'group'
): Promise<{ success: boolean; post_id?: string; error?: string }> {
  try {
    // Get Durable Object stub
    const id = env.BROWSER_SESSION.idFromName('facebook-session');
    const stub = env.BROWSER_SESSION.get(id);

    // Call /post endpoint on Durable Object
    const response = await stub.fetch('https://dummy/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, target })
    });

    const result = await response.json();

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Unknown error from BrowserSession'
      };
    }

    return {
      success: true,
      post_id: result.post_id
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Network error'
    };
  }
}

async function processPendingPostsInternal(
  env: any,
  now: number
): Promise<{ posted: number; failed: number; pagePostId?: string; groupPostId?: string }> {
  const db = env.DB;
  const pageId = env.FB_PAGE_ID;
  const pageToken = env.FB_PAGE_ACCESS_TOKEN;
  const groupId = env.FB_GROUP_ID;
  const groupToken = env.FB_ACCESS_TOKEN || env.FB_PAGE_ACCESS_TOKEN;

  let posted = 0;
  let failed = 0;
  let lastPagePostId: string | undefined;
  let lastGroupPostId: string | undefined;

  try {
    // Get posts scheduled within ±5 minute window
    const windowStart = now - 300; // 5 minutes ago
    const windowEnd = now + 300; // 5 minutes from now

    const pendingPosts = await db
      .prepare(`
        SELECT * FROM facebook_content_queue
        WHERE status = 'pending'
        AND scheduled_for >= ?
        AND scheduled_for <= ?
        ORDER BY priority DESC, scheduled_for ASC
      `)
      .bind(windowStart, windowEnd)
      .all();

    for (const post of pendingPosts.results as FacebookContentQueue[]) {
      try {
        let pagePostId: string | null = null;
        let groupPostId: string | null = null;

        // Post to Page if needed (using Official Graph API)
        if ((post.target_type === 'page' || post.target_type === 'both') && pageId && pageToken) {
          console.log(`Posting to Page via Official API`);
          const pageResponse = await officialPostToPage(pageId, pageToken, {
            message: post.message,
            link: post.link || undefined,
            imageUrl: post.image_url || undefined
          });

          if (!pageResponse.success) {
            throw new Error(`Page post failed: ${pageResponse.error}`);
          }

          pagePostId = pageResponse.post_id || null;
          lastPagePostId = pagePostId || undefined;
          console.log(`Posted to Page via Official API: ${pagePostId}`);
        }

        // Rate limit between posts (small delay to avoid rate limits)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Post to Group if needed (using Official Graph API)
        if ((post.target_type === 'group' || post.target_type === 'both') && groupId && groupToken) {
          console.log(`Posting to Group via Official API`);
          const groupResponse = await officialPostToGroup(groupId, groupToken, {
            message: post.message,
            link: post.link || undefined
          });

          if (!groupResponse.success) {
            throw new Error(`Group post failed: ${groupResponse.error}`);
          }

          groupPostId = groupResponse.post_id || null;
          lastGroupPostId = groupPostId || undefined;
          console.log(`Posted to Group via Official API: ${groupPostId}`);
        }

        // Update queue status to posted
        await db
          .prepare(`
            UPDATE facebook_content_queue
            SET status = 'posted',
                posted_at = ?,
                page_post_id = ?,
                group_post_id = ?
            WHERE id = ?
          `)
          .bind(now, pagePostId, groupPostId, post.id)
          .run();

        // Track in posted_content table for deduplication
        if (post.business_id) {
          await db
            .prepare(`
              INSERT INTO facebook_posted_content
              (content_type, content_id, target_type, queue_id)
              VALUES ('business_spotlight', ?, ?, ?)
            `)
            .bind(post.business_id, post.target_type, post.id)
            .run();
        } else if (post.blog_post_id) {
          await db
            .prepare(`
              INSERT INTO facebook_posted_content
              (content_type, content_id, target_type, queue_id)
              VALUES ('blog_share', ?, ?, ?)
            `)
            .bind(post.blog_post_id, post.target_type, post.id)
            .run();
        } else if (post.category_id) {
          await db
            .prepare(`
              INSERT INTO facebook_posted_content
              (content_type, content_id, target_type, queue_id)
              VALUES ('category_highlight', ?, ?, ?)
            `)
            .bind(post.category_id, post.target_type, post.id)
            .run();
        }

        // Create initial analytics records
        if (pagePostId) {
          await db
            .prepare(`
              INSERT INTO facebook_post_analytics
              (queue_id, post_id, target_type)
              VALUES (?, ?, 'page')
            `)
            .bind(post.id, pagePostId)
            .run();
        }

        if (groupPostId) {
          await db
            .prepare(`
              INSERT INTO facebook_post_analytics
              (queue_id, post_id, target_type)
              VALUES (?, ?, 'group')
            `)
            .bind(post.id, groupPostId)
            .run();
        }

        posted++;
        await delayForRateLimit();
      } catch (error: any) {
        console.error(`Failed to post queue item ${post.id}:`, error);

        // Mark as failed
        await db
          .prepare(`
            UPDATE facebook_content_queue
            SET status = 'failed',
                error_message = ?
            WHERE id = ?
          `)
          .bind(error.message, post.id)
          .run();

        failed++;
      }
    }

    return { posted, failed, pagePostId: lastPagePostId, groupPostId: lastGroupPostId };
  } catch (error: any) {
    console.error('Error processing pending posts:', error);
    return { posted, failed, pagePostId: lastPagePostId, groupPostId: lastGroupPostId };
  }
}

/**
 * Monitor recent posts for comments and auto-respond (runs every 2 hours)
 */
async function monitorAndRespondToComments(env: any): Promise<void> {
  const db = env.DB;
  const pageToken = env.FB_PAGE_ACCESS_TOKEN;

  if (!pageToken) {
    console.log('No page access token, skipping comment monitoring');
    return;
  }

  try {
    // Get posts from last 24 hours
    const yesterday = Math.floor(Date.now() / 1000) - (24 * 60 * 60);

    const recentPosts = await db
      .prepare(`
        SELECT
          fcq.id,
          fcq.page_post_id,
          fcq.group_post_id,
          fcq.message,
          fcq.target_type
        FROM facebook_content_queue fcq
        WHERE fcq.status = 'posted'
        AND fcq.posted_at > ?
        AND (fcq.page_post_id IS NOT NULL OR fcq.group_post_id IS NOT NULL)
        ORDER BY fcq.posted_at DESC
      `)
      .bind(yesterday)
      .all();

    if (!recentPosts.results || recentPosts.results.length === 0) {
      console.log('No recent posts to monitor');
      return;
    }

    // Build post ID list and context map
    const postIds: string[] = [];
    const postContextMap = new Map<string, string>();

    for (const post of recentPosts.results as any[]) {
      if (post.page_post_id) {
        postIds.push(post.page_post_id);
        postContextMap.set(post.page_post_id, post.message || 'Local business post');
      }
      // Note: Group posts require different permissions, skipping for now
    }

    if (postIds.length === 0) {
      console.log('No page posts to monitor');
      return;
    }

    // Process comments
    const result = await processComments(env, postIds, postContextMap, pageToken);
    console.log(`Comment monitoring complete:`, result);

  } catch (error) {
    console.error('Error monitoring comments:', error);
  }
}

/**
 * Update analytics for recent posts (runs daily at 2 AM)
 */
async function updatePostAnalytics(env: any): Promise<void> {
  const db = env.DB;
  const pageToken = env.FB_PAGE_ACCESS_TOKEN;

  try {
    // Get posts from last 7 days that need analytics update
    const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 86400);

    const recentPosts = await db
      .prepare(`
        SELECT fpa.*, fcq.posted_at
        FROM facebook_post_analytics fpa
        JOIN facebook_content_queue fcq ON fcq.id = fpa.queue_id
        WHERE fcq.posted_at > ?
        AND fcq.posted_at < ?
        ORDER BY fcq.posted_at DESC
        LIMIT 100
      `)
      .bind(sevenDaysAgo, Math.floor(Date.now() / 1000) - 3600) // At least 1 hour old
      .all();

    for (const analytics of recentPosts.results as any[]) {
      try {
        // Only fetch Page insights (requires Page token)
        if (analytics.target_type === 'page' && pageToken) {
          const insights = await getPostInsights(analytics.post_id, pageToken);

          await db
            .prepare(`
              UPDATE facebook_post_analytics
              SET impressions = ?,
                  reach = ?,
                  engaged_users = ?,
                  clicks = ?,
                  reactions_breakdown = ?,
                  last_updated = ?
              WHERE id = ?
            `)
            .bind(
              insights.post_impressions || 0,
              insights.post_impressions_unique || 0,
              insights.post_engaged_users || 0,
              insights.post_clicks || 0,
              JSON.stringify(insights.post_reactions_by_type_total || {}),
              Math.floor(Date.now() / 1000),
              analytics.id
            )
            .run();
        }

        // Get engagement counts (works for both Page and Group)
        const engagement = await getPostEngagement(
          analytics.post_id,
          analytics.target_type === 'page' ? pageToken : env.FB_ACCESS_TOKEN
        );

        await db
          .prepare(`
            UPDATE facebook_post_analytics
            SET likes_count = ?,
                comments_count = ?,
                shares_count = ?,
                last_updated = ?
            WHERE id = ?
          `)
          .bind(
            engagement.likes,
            engagement.comments,
            engagement.shares,
            Math.floor(Date.now() / 1000),
            analytics.id
          )
          .run();

        // Rate limit
        await delayForRateLimit();
      } catch (error: any) {
        console.error(`Failed to update analytics for post ${analytics.post_id}:`, error);
      }
    }

    console.log(`Updated analytics for ${recentPosts.results?.length || 0} posts`);
  } catch (error: any) {
    console.error('Error updating post analytics:', error);
  }
}

async function enrichAllBusinesses(env: any) {
  const db = env.DB;
  const token = env.FB_ACCESS_TOKEN;

  if (!token) {
    console.log('No FB_ACCESS_TOKEN, skipping enrichment');
    return { skipped: true };
  }

  // Find businesses needing enrichment (never enriched or >24h ago)
  const staleTime = Math.floor(Date.now() / 1000) - 86400;
  const businesses = await db
    .prepare(`
      SELECT id, name, facebook_url
      FROM businesses
      WHERE facebook_url IS NOT NULL
        AND is_active = 1
        AND (last_facebook_enrichment IS NULL OR last_facebook_enrichment < ?)
      LIMIT 50
    `)
    .bind(staleTime)
    .all();

  const results = { processed: 0, errors: 0 };

  for (const biz of businesses.results || []) {
    try {
      await enrichSingleBusiness(env, biz.id);
      results.processed++;
      await new Promise((r) => setTimeout(r, 500)); // Rate limiting
    } catch (err: any) {
      console.error(`Failed to enrich business ${biz.id}:`, err);
      results.errors++;
    }
  }

  console.log('Enrichment complete:', results);
  return results;
}

async function enrichSingleBusiness(env: any, businessId: number) {
  const db = env.DB;
  const token = env.FB_ACCESS_TOKEN;

  if (!token) throw new Error('FB_ACCESS_TOKEN not configured');

  // Check rate limit
  if (await checkRateLimit(env, 'facebook-enrichment')) {
    throw new Error('Rate limit exceeded');
  }

  // Get business
  const biz = await db
    .prepare('SELECT * FROM businesses WHERE id = ?')
    .bind(businessId)
    .first();

  if (!biz || !biz.facebook_url) {
    throw new Error('Business not found or no Facebook URL');
  }

  try {
    // Extract page ID
    const pageId = await extractPageIdFromUrl(biz.facebook_url, token);
    if (!pageId) {
      throw new Error('Could not extract page ID');
    }

    // Fetch page info and posts
    const [pageInfo, posts] = await Promise.all([
      getPageInfo(pageId, token),
      getPagePosts(pageId, token, 20),
    ]);

    if (posts.length === 0) {
      await db
        .prepare(`
          UPDATE businesses
          SET facebook_page_id = ?,
              last_facebook_enrichment = ?,
              facebook_enrichment_status = 'success',
              facebook_post_count = 0
          WHERE id = ?
        `)
        .bind(pageId, Math.floor(Date.now() / 1000), businessId)
        .run();

      return { status: 'no_posts', pageId };
    }

    // AI analysis - select top 3 posts
    const topPosts = await selectTopPosts(posts, biz.name, env);

    // Delete old posts
    await db
      .prepare('DELETE FROM facebook_posts WHERE business_id = ?')
      .bind(businessId)
      .run();

    // Insert top posts
    for (const post of topPosts) {
      const embedCode = generatePostEmbedCode(post.permalink_url);
      await db
        .prepare(`
          INSERT INTO facebook_posts
          (business_id, post_id, post_url, message, created_time, embed_code,
           ai_quality_score, relevance_tags, likes_count, comments_count, shares_count)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          businessId,
          post.id,
          post.permalink_url,
          post.message || '',
          post.created_time,
          embedCode,
          post.analysis.quality_score,
          JSON.stringify(post.analysis.relevance_tags),
          post.reactions?.summary?.total_count || 0,
          post.comments?.summary?.total_count || 0,
          post.shares?.count || 0
        )
        .run();
    }

    // Calculate verification score
    const verificationScore = calculateVerificationScore(pageInfo, posts);
    const shouldVerify = verificationScore >= 70;

    // Update business
    await db
      .prepare(`
        UPDATE businesses
        SET facebook_page_id = ?,
            last_facebook_enrichment = ?,
            facebook_enrichment_status = 'success',
            facebook_enrichment_error = NULL,
            facebook_post_count = ?,
            is_verified = CASE WHEN ? THEN 1 ELSE is_verified END
        WHERE id = ?
      `)
      .bind(
        pageId,
        Math.floor(Date.now() / 1000),
        topPosts.length,
        shouldVerify,
        businessId
      )
      .run();

    // Cache in KV
    const cacheKey = `fb_enrichment:${businessId}`;
    await env.CACHE.put(
      cacheKey,
      JSON.stringify({
        posts: topPosts.map((p) => ({
          id: p.id,
          url: p.permalink_url,
          message: p.message,
          score: p.analysis.quality_score,
          tags: p.analysis.relevance_tags,
        })),
        verification_score: verificationScore,
        updated_at: Date.now(),
      }),
      { expirationTtl: 86400 }
    );

    return {
      status: 'success',
      pageId,
      postsAnalyzed: posts.length,
      topPosts: topPosts.length,
      verificationScore,
      verified: shouldVerify,
    };
  } catch (error: any) {
    // Silent failure - update error status
    await db
      .prepare(`
        UPDATE businesses
        SET facebook_enrichment_status = 'error',
            facebook_enrichment_error = ?,
            last_facebook_enrichment = ?
        WHERE id = ?
      `)
      .bind(error.message, Math.floor(Date.now() / 1000), businessId)
      .run();

    throw error;
  }
}
