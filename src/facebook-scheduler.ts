import type { FacebookContentQueue } from './types';

function makeContentHash(input: string): Promise<string> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then((buf) =>
    Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

export async function populateContentQueue(env: any): Promise<{ created: number; skipped: number }> {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);
  const siteUrl = env.SITE_URL || 'https://kiamichibizconnect.com';

  const businesses = await db
    .prepare(`
      SELECT id, name, slug, city, state, description, facebook_url
      FROM businesses
      WHERE is_active = 1
      ORDER BY RANDOM()
      LIMIT 10
    `)
    .all();

  let created = 0;
  let skipped = 0;

  for (const business of (businesses.results || []) as any[]) {
    const message = `Take a look at ${business.name}${business.city ? ` in ${business.city}, ${business.state}` : ''}. ${business.description || 'A local business worth checking out.'}`;
    const link = `${siteUrl}/business/${business.slug}`;
    const contentHash = await makeContentHash(`${business.id}:${message}:${link}`);

    const existing = await db
      .prepare(`
        SELECT id FROM facebook_content_queue
        WHERE content_hash = ?
        LIMIT 1
      `)
      .bind(contentHash)
      .first();

    if (existing) {
      skipped++;
      continue;
    }

    await db
      .prepare(`
        INSERT INTO facebook_content_queue (
          content_type,
          target_type,
          business_id,
          message,
          link,
          image_url,
          scheduled_for,
          status,
          priority,
          content_hash,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        'business_spotlight',
        business.facebook_url ? 'both' : 'page',
        business.id,
        message,
        link,
        null,
        now,
        'pending',
        5,
        contentHash,
        now
      )
      .run();

    created++;
  }

  return { created, skipped };
}

export async function getQueueStatus(env: any, limit = 20): Promise<FacebookContentQueue[]> {
  const result = await env.DB
    .prepare(`
      SELECT *
      FROM facebook_content_queue
      ORDER BY scheduled_for DESC, created_at DESC
      LIMIT ?
    `)
    .bind(limit)
    .all();

  return (result.results || []) as FacebookContentQueue[];
}

export async function getAnalyticsSummary(env: any): Promise<Record<string, unknown>> {
  const db = env.DB;

  const queueCounts = await db
    .prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'posted' THEN 1 ELSE 0 END) as posted,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM facebook_content_queue
    `)
    .first();

  const recentAnalytics = await db
    .prepare(`
      SELECT COUNT(*) as total
      FROM facebook_post_analytics
      WHERE last_updated >= ?
    `)
    .bind(Math.floor(Date.now() / 1000) - 7 * 86400)
    .first();

  return {
    queue: queueCounts || {},
    recentAnalytics: recentAnalytics || {},
  };
}
