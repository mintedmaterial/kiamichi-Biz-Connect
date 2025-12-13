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

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
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
  }
};

// Scheduled handler — called by Cloudflare on cron
export async function scheduled(controller: any, env: any) {
  try {
    // Run both group posting and enrichment
    await runOnce(env, { test: false });
    await enrichAllBusinesses(env);
  } catch (err) {
    console.error('Scheduled run failed', err);
  }
}

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
