/**
 * VIP Business Daily Post Generator
 * Creates unique, varied content for VIP/family businesses
 * 
 * Rules:
 * - Never repeat the same angle within 8 days
 * - Rotate through: services, testimonial, seasonal, promotion, new_product, behind_scenes, team, community
 * - 30% chance of Bigfoot Jr. mascot
 * - Track all posts to avoid duplicates
 */

import { generateBusinessImageWithMascot, shouldIncludeMascot } from '../../../src/bigfoot-mascot';

export interface VIPBusiness {
  id: number;
  business_id: number;
  vip_type: string;
  post_frequency: string;
  business: {
    id: number;
    name: string;
    slug: string;
    description: string;
    city: string;
    state: string;
    facebook_url?: string;
    google_rating?: number;
  };
}

export interface VIPPostResult {
  businessId: number;
  businessName: string;
  angle: string;
  message: string;
  imageUrl?: string;
  hadMascot: boolean;
  success: boolean;
  error?: string;
  postId?: string;
}

const POST_ANGLES = [
  'services',
  'testimonial',
  'seasonal',
  'promotion',
  'new_product',
  'behind_scenes',
  'team',
  'community'
];

/**
 * Get VIP businesses that need posts today
 */
export async function getVIPBusinessesForPosting(env: any): Promise<VIPBusiness[]> {
  const db = env.DB;
  
  const result = await db.prepare(`
    SELECT 
      vb.*,
      b.id as biz_id,
      b.name,
      b.slug,
      b.description,
      b.city,
      b.state,
      b.facebook_url,
      b.google_rating
    FROM vip_businesses vb
    INNER JOIN businesses b ON vb.business_id = b.id
    WHERE b.is_active = 1
    AND (
      vb.post_frequency = 'daily'
      OR (vb.post_frequency = 'weekly' AND strftime('%w', 'now') = '1')
      OR (vb.post_frequency = 'bi-weekly' AND strftime('%W', 'now') % 2 = 0 AND strftime('%w', 'now') = '1')
    )
  `).all();
  
  return (result.results || []).map((row: any) => ({
    id: row.id,
    business_id: row.business_id,
    vip_type: row.vip_type,
    post_frequency: row.post_frequency,
    business: {
      id: row.biz_id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      city: row.city,
      state: row.state,
      facebook_url: row.facebook_url,
      google_rating: row.google_rating
    }
  }));
}

/**
 * Get the next unused angle for a business
 */
async function getNextAngle(env: any, businessId: number): Promise<string> {
  const db = env.DB;
  const eightDaysAgo = Math.floor(Date.now() / 1000) - (8 * 86400);
  
  // Get angles used in the last 8 days
  const usedAngles = await db.prepare(`
    SELECT DISTINCT post_angle FROM vip_post_history
    WHERE business_id = ? AND posted_at > ?
  `).bind(businessId, eightDaysAgo).all();
  
  const usedSet = new Set((usedAngles.results || []).map((r: any) => r.post_angle));
  
  // Find an unused angle
  for (const angle of POST_ANGLES) {
    if (!usedSet.has(angle)) {
      return angle;
    }
  }
  
  // All angles used recently, pick least recently used
  const leastRecent = await db.prepare(`
    SELECT post_angle, MAX(posted_at) as last_used
    FROM vip_post_history
    WHERE business_id = ?
    GROUP BY post_angle
    ORDER BY last_used ASC
    LIMIT 1
  `).bind(businessId).first();
  
  return leastRecent?.post_angle || POST_ANGLES[0];
}

/**
 * Get prompt template for an angle
 */
async function getAnglePrompt(env: any, angle: string): Promise<string> {
  const db = env.DB;
  
  const template = await db.prepare(`
    SELECT prompt_template FROM post_angle_templates
    WHERE angle_name = ? AND is_active = 1
  `).bind(angle).first();
  
  return template?.prompt_template || `Create an engaging post about {business_name} in {city}, focusing on ${angle}.`;
}

/**
 * Generate a unique post for a VIP business
 */
export async function generateVIPPost(
  env: any,
  vipBusiness: VIPBusiness
): Promise<VIPPostResult> {
  const { business } = vipBusiness;
  
  try {
    // Get next angle to use
    const angle = await getNextAngle(env, business.id);
    const promptTemplate = await getAnglePrompt(env, angle);
    
    // Build the prompt with business details
    const prompt = promptTemplate
      .replace(/{business_name}/g, business.name)
      .replace(/{city}/g, business.city)
      .replace(/{state}/g, business.state)
      .replace(/{service_type}/g, business.description || 'services');
    
    // Generate content using Workers AI
    const systemPrompt = `You are a friendly local community member in Southeast Oklahoma who loves supporting local businesses.
Write warm, genuine social media posts. NO hashtags. Sound like a real person, not a marketer.
Keep posts 80-120 words. Use casual language and local flavor.
${business.facebook_url 
  ? `IMPORTANT: Tag the business using @${business.name.replace(/\s+/g, '')} (remove ALL spaces from name!)`
  : `Mention ${business.name} naturally but don't use @tag.`
}`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 250,
      temperature: 0.9
    });
    
    let message = ((aiResponse as any).response || '').trim().replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');
    
    // Add listing link
    const siteUrl = env.SITE_URL || 'https://kiamichibizconnect.com';
    const link = `${siteUrl}/business/${business.slug}?utm_source=facebook&utm_medium=page&utm_campaign=vip_${angle}`;
    message += `\n\n🔗 ${link}`;
    
    // Determine if we should include mascot (30% chance)
    const includeMascot = shouldIncludeMascot('business_spotlight', business.id);
    
    // Generate image
    let imageUrl: string | undefined;
    try {
      imageUrl = await generateBusinessImageWithMascot(
        env,
        business.id,
        business.description || 'local business',
        business.city,
        business.name,
        includeMascot
      );
    } catch (imgError) {
      console.warn(`[VIP] Image generation failed for ${business.name}:`, imgError);
    }
    
    return {
      businessId: business.id,
      businessName: business.name,
      angle,
      message,
      imageUrl,
      hadMascot: includeMascot,
      success: true
    };
  } catch (error: any) {
    console.error(`[VIP] Failed to generate post for ${business.name}:`, error);
    return {
      businessId: business.id,
      businessName: business.name,
      angle: 'error',
      message: '',
      hadMascot: false,
      success: false,
      error: error.message
    };
  }
}

/**
 * Record that a VIP post was made
 */
export async function recordVIPPost(
  env: any,
  businessId: number,
  angle: string,
  contentHash: string,
  postId: string,
  hadMascot: boolean
): Promise<void> {
  const db = env.DB;
  
  await db.prepare(`
    INSERT INTO vip_post_history
    (business_id, post_angle, post_content_hash, post_id, had_mascot)
    VALUES (?, ?, ?, ?, ?)
  `).bind(businessId, angle, contentHash, postId, hadMascot ? 1 : 0).run();
}

/**
 * Process all VIP businesses and generate/post content
 */
export async function processVIPBusinesses(env: any): Promise<{
  processed: number;
  posted: number;
  failed: number;
  results: VIPPostResult[];
}> {
  const vipBusinesses = await getVIPBusinessesForPosting(env);
  
  const results: VIPPostResult[] = [];
  let posted = 0;
  let failed = 0;
  
  for (const vipBiz of vipBusinesses) {
    const result = await generateVIPPost(env, vipBiz);
    
    if (result.success && result.message) {
      // Post to Facebook (would use officialPostToPage here)
      // For now, just track the result
      results.push(result);
      posted++;
    } else {
      results.push(result);
      failed++;
    }
    
    // Rate limit between posts
    await new Promise(r => setTimeout(r, 2000));
  }
  
  return {
    processed: vipBusinesses.length,
    posted,
    failed,
    results
  };
}
