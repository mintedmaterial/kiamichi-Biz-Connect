import { Env } from '../types';
import { DatabaseService } from '../database';

/**
 * Independent Blog Worker
 * Generates blog content with AI-generated images using Flux 2 Dev
 * Can be triggered manually from admin panel or via cron/workflow
 */

export interface BlogGenerationRequest {
  type: 'business_spotlight' | 'category' | 'service_area' | 'business_tips';
  business_id?: number;
  category_id?: number;
  city?: string;
  topic?: string;
  customPrompt?: string; // Optional custom prompt to guide generation
}

export interface BlogGenerationResult {
  success: boolean;
  blog_id?: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image?: string;
  candidate_images?: string[]; // R2 keys for the 3 generated images
  message?: string; // Success message for UI
  error?: string;
}

/**
 * Main blog worker function
 */
export async function runBlogWorker(
  env: Env,
  db: DatabaseService,
  request: BlogGenerationRequest
): Promise<BlogGenerationResult> {
  try {
    console.log('Blog worker started:', request.type);

    // Step 1: Generate blog content
    const blogData = await generateBlogContent(env, db, request);

    let imageKeys: string[] = [];
    let shouldGenerateImages = true;

    // Step 2: Check if we should use existing business image instead of generating
    if (request.type === 'business_spotlight' && request.business_id) {
      const business = await db.db.prepare('SELECT image_url FROM businesses WHERE id = ?').bind(request.business_id).first();
      if (business && (business as any).image_url) {
        console.log('Using existing business image instead of generating');
        shouldGenerateImages = false;
        // Set the featured_image directly - no candidate images needed
        blogData.featured_image = (business as any).image_url;
      }
    }

    // Step 3: For category blogs, check if we can use a featured business image
    if (request.type === 'category' && request.category_id) {
      const categoryBiz = await db.db.prepare(
        'SELECT image_url FROM businesses WHERE category_id = ? AND image_url IS NOT NULL AND is_active = 1 LIMIT 1'
      ).bind(request.category_id).first();

      if (categoryBiz && (categoryBiz as any).image_url) {
        console.log('Using featured category business image');
        shouldGenerateImages = false;
        blogData.featured_image = (categoryBiz as any).image_url;
      }
    }

    // Step 4: Generate images only for business_tips, service_area, or when no existing image
    if (shouldGenerateImages) {
      console.log('Generating AI images for blog');
      // Extract keywords from blog for image generation
      const imageKeywords = await extractImageKeywords(env, blogData.title, blogData.content, request.customPrompt);

      // Generate 3 images using Flux 2 Dev
      imageKeys = await generateBlogImages(env, imageKeywords, blogData.slug);
    }

    // Step 5: Save blog post as draft with candidate images (if any)
    const blogId = await saveBlogWithImages(db, blogData, imageKeys);

    console.log(`Blog generated successfully: ID ${blogId} with ${imageKeys.length} candidate images`);

    return {
      success: true,
      blog_id: blogId, // Return blog ID so UI knows it's saved
      title: blogData.title,
      slug: blogData.slug,
      excerpt: blogData.excerpt,
      content: blogData.content,
      featured_image: blogData.featured_image,
      candidate_images: imageKeys.length > 0 ? imageKeys : undefined,
      message: imageKeys.length > 0
        ? `Blog saved as draft with ${imageKeys.length} candidate image(s). Go to Manage Blogs to approve images and publish.`
        : 'Blog saved as draft. No images were generated.'
    };

  } catch (error) {
    console.error('Blog worker error:', error);
    return {
      success: false,
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Generate blog content using Llama 3 8B
 */
async function generateBlogContent(
  env: Env,
  db: DatabaseService,
  request: BlogGenerationRequest
): Promise<{ title: string; slug: string; excerpt: string; content: string; featured_image?: string }> {

  let prompt = '';
  let title = '';
  let slug = '';
  let excerpt = '';
  let featured_image = '';

  // Build prompt based on blog type
  if (request.type === 'business_spotlight') {
    const business = await db.db.prepare('SELECT * FROM businesses WHERE id = ?').bind(request.business_id).first();
    if (!business) throw new Error('Business not found');

    title = `Spotlight: ${business.name} - ${business.city}'s Premier Business`;
    // Add timestamp suffix to prevent duplicate spotlights
    const timestamp = Date.now().toString().slice(-6);
    slug = `spotlight-${(business as any).slug}-${timestamp}`;
    excerpt = `Discover ${business.name} in ${business.city}, ${business.state}. ${business.description || 'A trusted local business serving the community.'}`.substring(0, 160);
    featured_image = (business as any).image_url || '';

    const customGuidance = request.customPrompt ? `\n\nAdditional guidance: ${request.customPrompt}` : '';

    prompt = `Write a 600-word SEO-optimized blog post featuring ${business.name}, a business located in ${business.city}, ${business.state}.

Business Details:
- Name: ${business.name}
- Location: ${business.city}, ${business.state}
${(business as any).google_rating ? `- Rating: ${(business as any).google_rating} stars (${(business as any).review_count || 0} reviews)` : ''}
${business.description ? `- Services: ${business.description}` : ''}
${(business as any).website ? `- Website: ${(business as any).website}` : ''}

Include:
1. Opening paragraph highlighting what makes this business special
2. Services they offer with specific local details
3. Why local customers love them
4. How to contact them
5. Call-to-action encouraging readers to visit

Tone: Friendly, local, supportive of small businesses
SEO Focus: "${business.city} ${business.description || 'business'}", "local business ${business.city}"
Format: Markdown with ## for H2, ### for H3${customGuidance}

Write the blog post now in markdown format:`;

  } else if (request.type === 'category') {
    const category = await db.db.prepare('SELECT * FROM categories WHERE id = ?').bind(request.category_id).first();
    if (!category) throw new Error('Category not found');

    const categoryBusinesses = await db.getBusinessesByCategory((category as any).slug, 5);

    title = `Complete Guide to ${(category as any).name} Services in Southeast Oklahoma 2025`;
    slug = `guide-${(category as any).slug}-southeast-oklahoma`;
    excerpt = `Find the best ${(category as any).name} services in Southeast Oklahoma. Expert guide with tips for choosing providers.`;

    const businessList = categoryBusinesses.map((b: any) => `- ${b.name} (${b.city}, ${b.state})`).join('\n');
    const customGuidance = request.customPrompt ? `\n\nAdditional guidance: ${request.customPrompt}` : '';

    prompt = `Write a 1200-word SEO-optimized educational blog post about ${(category as any).name} services in Southeast Oklahoma.

Include:
1. Introduction to ${(category as any).name} services
2. What to look for when choosing a provider
3. Common questions about ${(category as any).name}
4. Featured local businesses:
${businessList}

Tone: Educational, helpful, community-focused
Format: Markdown with ## for H2, ### for H3${customGuidance}

Write the blog post now:`;

  } else if (request.type === 'service_area') {
    const city = request.city || 'Valliant';
    const cityBusinesses = await db.db.prepare('SELECT * FROM businesses WHERE city = ? AND is_active = 1 LIMIT 5').bind(city).all();

    title = `Best Local Businesses in ${city}, Oklahoma - 2025 Community Guide`;
    slug = `local-businesses-${city.toLowerCase().replace(/\s+/g, '-')}`;
    excerpt = `Discover the best local businesses in ${city}, Oklahoma. Support your community.`;

    const businessList = (cityBusinesses.results || []).map((b: any) => `- ${b.name} - ${b.description || 'Local business'}`).join('\n');
    const customGuidance = request.customPrompt ? `\n\nAdditional guidance: ${request.customPrompt}` : '';

    prompt = `Write a 700-word article about local businesses in ${city}, Oklahoma.

Include:
1. Overview of the local business community
2. Featured businesses:
${businessList}
3. Why supporting local matters

Tone: Community-proud, informative
Format: Markdown${customGuidance}

Write the blog post now:`;

  } else if (request.type === 'business_tips') {
    const topic = request.topic || 'Small Business Marketing Tips';
    title = topic;
    // Add timestamp to ensure unique slug
    const timestamp = Date.now().toString().slice(-6);
    slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + timestamp;
    excerpt = `Expert tips and insights about ${topic} for small businesses in Southeast Oklahoma.`;

    const customGuidance = request.customPrompt ? `\n\nAdditional guidance: ${request.customPrompt}` : '';

    prompt = `Write an 800-word informative blog post about: ${topic}

Focus on practical advice for small businesses in Southeast Oklahoma.

Include:
1. Why this topic matters
2. 4-5 main sections with practical tips
3. Real-world examples
4. Implementation strategies

Tone: Professional, helpful
Format: Markdown${customGuidance}

Write the blog post now:`;
  }

  // Call Llama AI to generate content
  const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: 'You are an expert SEO content writer specializing in local business marketing.' },
      { role: 'user', content: prompt }
    ],
    max_tokens: 2500
  });

  const content = (aiResponse as any).response || '';

  return { title, slug, excerpt, content, featured_image };
}

/**
 * Extract keywords from blog content for image generation
 */
async function extractImageKeywords(
  env: Env,
  title: string,
  content: string,
  customPrompt?: string
): Promise<string[]> {

  const customGuidance = customPrompt ? ` Consider this context: ${customPrompt}` : '';

  const prompt = `Based on this blog post title and content, generate 3 diverse image prompts for blog illustrations.

Title: ${title}
Content excerpt: ${content.substring(0, 500)}...

Generate 3 different image prompts that would make great blog illustrations:
1. A scenic/landscape image related to Oklahoma/local area
2. A professional tradesman or business scene
3. A business storefront or community scene${customGuidance}

Return ONLY a JSON array of 3 strings, each being a detailed image prompt (30-50 words each).
Example format: ["professional electrician working on residential panel in modern Oklahoma home, bright natural lighting, safety equipment visible, clean professional appearance", "..."]`;

  try {
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: 'You are an expert at creating detailed image generation prompts.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const responseText = (aiResponse as any).response || '';

    // Extract JSON array from response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const keywords = JSON.parse(jsonMatch[0]);
      if (Array.isArray(keywords) && keywords.length >= 3) {
        return keywords.slice(0, 3);
      }
    }

    // Fallback prompts if AI fails
    throw new Error('Could not extract keywords');

  } catch (error) {
    console.warn('Keyword extraction failed, using fallback prompts:', error);
    return [
      'scenic Oklahoma landscape with rolling hills, blue sky, professional photography, vibrant colors, natural lighting',
      'professional tradesman working on home improvement project, modern tools, safety equipment, clean workspace',
      'local business storefront in small town Oklahoma, welcoming entrance, professional signage, community atmosphere'
    ];
  }
}

/**
 * Generate 3 images using Flux 2 Dev
 */
async function generateBlogImages(
  env: Env,
  prompts: string[],
  slugBase: string
): Promise<string[]> {

  const imageKeys: string[] = [];
  const timestamp = Date.now();

  for (let i = 0; i < prompts.length; i++) {
    try {
      console.log(`Generating image ${i + 1}/3 with prompt:`, prompts[i]);

      // Create FormData for Flux 2 Dev
      const form = new FormData();
      form.append('prompt', prompts[i]);
      form.append('width', '1024');
      form.append('height', '1024');

      // Create a dummy request to extract the form body stream and content-type
      const formRequest = new Request('http://dummy', {
        method: 'POST',
        body: form
      });
      const formStream = formRequest.body;
      const formContentType = formRequest.headers.get('content-type') || 'multipart/form-data';

      // Call Flux 2 Dev with proper multipart format
      const response = await env.AI.run('@cf/black-forest-labs/flux-2-dev', {
        multipart: {
          body: formStream,
          contentType: formContentType
        }
      });

      // Convert base64 image to buffer
      const imageBase64 = (response as any).image;
      if (!imageBase64) {
        throw new Error('No image returned from Flux API');
      }

      const imageBuffer = Uint8Array.from(atob(imageBase64), c => c.charCodeAt(0));

      // Upload to R2
      const imageKey = `blog/${slugBase}-${timestamp}-${i + 1}.png`;
      await env.IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/png'
        },
        customMetadata: {
          prompt: prompts[i],
          generated_at: timestamp.toString(),
          index: (i + 1).toString()
        }
      });

      imageKeys.push(imageKey);
      console.log(`Image ${i + 1} uploaded to R2:`, imageKey);

    } catch (error) {
      console.error(`Failed to generate image ${i + 1}:`, error);
      // Continue with other images even if one fails
    }
  }

  if (imageKeys.length === 0) {
    throw new Error('Failed to generate any images');
  }

  return imageKeys;
}

/**
 * Save blog post with candidate images
 */
async function saveBlogWithImages(
  db: DatabaseService,
  blogData: { title: string; slug: string; excerpt: string; content: string; featured_image?: string },
  imageKeys: string[]
): Promise<number> {

  // Create blog post as draft
  const blogId = await db.createBlogPost({
    title: blogData.title,
    slug: blogData.slug,
    excerpt: blogData.excerpt,
    content: blogData.content,
    featured_image: blogData.featured_image || null,
    author: 'KiamichiBizConnect AI',
    is_published: false, // Save as draft for approval
    business_id: null
  });

  // Save candidate images to blog_images table (only if images were generated)
  if (imageKeys.length > 0) {
    for (let i = 0; i < imageKeys.length; i++) {
      await db.db.prepare(`
        INSERT INTO blog_images (blog_post_id, image_key, image_prompt, display_order, is_approved, created_at)
        VALUES (?, ?, ?, ?, 0, unixepoch())
      `).bind(blogId, imageKeys[i], `AI Generated ${i + 1}`, i + 1).run();
    }
    console.log(`Saved ${imageKeys.length} candidate images for blog ${blogId}`);
  } else if (blogData.featured_image) {
    console.log(`Blog ${blogId} using existing business image: ${blogData.featured_image}`);
  }

  return blogId;
}
