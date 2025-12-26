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
import {
  postToPageWithImage,
  postToGroup,
  getPostInsights,
  getPostEngagement,
  delayForRateLimit
} from '../../../src/facebook-graph-api';
import { populateContentQueue, getQueueStatus, getAnalyticsSummary } from '../../../src/facebook-scheduler';
import type { FacebookContentQueue } from '../../../src/types';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // New endpoint: Post to Facebook immediately
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

          // Post to Facebook Page or Group
          const pageId = env.FB_PAGE_ID;
          const pageToken = env.FB_PAGE_ACCESS_TOKEN;
          const groupId = env.FB_GROUP_ID;
          const groupToken = env.FB_ACCESS_TOKEN;

          let pagePostId: string | null = null;
          let groupPostId: string | null = null;

          // Determine target (default to both if not specified)
          const targetType = target || 'both';

          if ((targetType === 'page' || targetType === 'both') && pageId && pageToken) {
            const pageResponse = await postToPageWithImage(pageId, pageToken, message, link, image_url);
            if (pageResponse.error) {
              console.error('Page post failed:', pageResponse.error);
            } else {
              pagePostId = pageResponse.id || null;
            }
          }

          if ((targetType === 'group' || targetType === 'both') && groupId && groupToken) {
            const groupResponse = await postToGroup(groupId, groupToken, message, link);
            if (groupResponse.error) {
              console.error('Group post failed:', groupResponse.error);
            } else {
              groupPostId = groupResponse.id || null;
            }
          }

          return new Response(JSON.stringify({
            success: true,
            pagePostId,
            groupPostId
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

  // Scheduled handler — called by Cloudflare on cron (every hour)
  async scheduled(controller: any, env: any) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const currentHour = new Date().getUTCHours();

      console.log(`Scheduled run starting at ${new Date().toISOString()}`);

      // Every hour:
      // 1. Populate queue for next 24 hours
      const queueResult = await populateContentQueue(env);
      console.log(`Queue population: ${queueResult.created} created, ${queueResult.skipped} skipped`);

      // 2. Process posts due now (±5 minute window)
      const postingResult = await processPendingPosts(env, now);
      console.log(`Posted: ${postingResult.posted} successful, ${postingResult.failed} failed`);

      // At 2 AM UTC only:
      // 3. Fetch analytics for recent posts
      // 4. Run business enrichment
      if (currentHour === 2) {
        console.log('Running 2 AM tasks: analytics update and business enrichment');
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
async function processPendingPosts(
  env: any,
  now: number
): Promise<{ posted: number; failed: number }> {
  const db = env.DB;
  const pageId = env.FB_PAGE_ID;
  const pageToken = env.FB_PAGE_ACCESS_TOKEN;
  const groupId = env.FB_GROUP_ID;
  const groupToken = env.FB_ACCESS_TOKEN;

  let posted = 0;
  let failed = 0;

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

        // Post to Page if needed
        if ((post.target_type === 'page' || post.target_type === 'both') && pageId && pageToken) {
          const pageResponse = await postToPageWithImage(
            pageId,
            pageToken,
            post.message,
            post.link || undefined,
            post.image_url || undefined
          );

          if (pageResponse.error) {
            throw new Error(`Page post failed: ${pageResponse.error.message}`);
          }

          pagePostId = pageResponse.id || null;
          console.log(`Posted to Page: ${pagePostId}`);
        }

        // Rate limit between posts
        await delayForRateLimit();

        // Post to Group if needed
        if ((post.target_type === 'group' || post.target_type === 'both') && groupId && groupToken) {
          const groupResponse = await postToGroup(
            groupId,
            groupToken,
            post.message,
            post.link || undefined
          );

          if (groupResponse.error) {
            throw new Error(`Group post failed: ${groupResponse.error.message}`);
          }

          groupPostId = groupResponse.id || null;
          console.log(`Posted to Group: ${groupPostId}`);
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

    return { posted, failed };
  } catch (error: any) {
    console.error('Error processing pending posts:', error);
    return { posted, failed };
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
