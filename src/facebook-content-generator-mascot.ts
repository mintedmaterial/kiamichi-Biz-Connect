// Enhanced Facebook Content Generator with Bigfoot Mascot Integration
// Integrates Bigfoot Jr. mascot into business spotlights and content generation

import type { ContentGenerationContext, Env } from './types';
import { generateBusinessSpotlightWithMascot, shouldIncludeMascot } from './bigfoot-mascot';

/**
 * Enhanced generate post content with mascot integration
 * Replaces the original function with mascot-aware version
 */
export async function generatePostContentWithMascot(
  context: ContentGenerationContext,
  env: Env
): Promise<{ message: string; link: string; imageUrl?: string }> {
  const { contentType, targetType, business, blogPost, category, siteUrl, utmCampaign } = context;

  // Build AI prompt based on content type
  const prompt = buildPrompt(contentType, targetType, context);

  // Detailed system prompt for human-like, authentic posts with mascot integration
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

BIGFOOT MASCOT INTEGRATION:
When generating content for business spotlights, include references to Bigfoot Jr. naturally:
- "Even Bigfoot Jr. couldn't resist stopping by..."
- "Bigfoot Jr. gives this place two big hairy thumbs up!"
- "Our friendly neighborhood Bigfoot Jr. recommends..."
Make it feel like the local mascot genuinely loves and supports our businesses.

Remember: You're NOT selling, you're SHARING something cool you found. Sound human!`;

  try {
    // Call Workers AI
    const aiResponse = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: 200,
      temperature: 0.9
    });

    let message = '';
    if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
      message = (aiResponse as any).response || '';
    } else {
      throw new Error('Invalid AI response format');
    }

    // Clean up message
    message = message.trim().replace(/\*\*/g, '').replace(/\n{3,}/g, '\n\n');

    // Build link with UTM parameters
    let link = '';
    let imageUrl: string | undefined;
    const productionUrl = 'https://kiamichibizconnect.com';

    if (business) {
      link = `${productionUrl}/business/${business.slug}?utm_source=facebook&utm_medium=${targetType}&utm_campaign=${utmCampaign}`;

      // Use existing business image if available
      imageUrl = business.image_url || undefined;

      // For business spotlights, integrate Bigfoot mascot
      if (contentType === 'business_spotlight') {
        const includeMascot = shouldIncludeMascot('business_spotlight', business.id);
        
        if (includeMascot) {
          try {
            console.log(`Generating business spotlight with mascot for: ${business.name}`);
            const mascotResult = await generateBusinessSpotlightWithMascot(env, business, true);
            message = mascotResult.message;
            if (mascotResult.imageUrl) {
              imageUrl = mascotResult.imageUrl;
            }
          } catch (error) {
            console.error('Mascot generation failed, using regular AI:', error);
          }
        }
      }

      // Fallback AI image generation if no image and business is featured
      if (!imageUrl && business.is_featured && Math.random() < 0.1) {
        try {
          console.log(`Generating AI image for featured business: ${business.name}`);
          imageUrl = await generateBusinessImage(env, business, message);
        } catch (error) {
          console.error('Failed to generate business image:', error);
        }
      }
    } else if (blogPost) {
      link = `${productionUrl}/blog/${blogPost.slug}?utm_source=facebook&utm_medium=${targetType}&utm_campaign=${utmCampaign}`;
      imageUrl = blogPost.featured_image || undefined;
    } else if (category) {
      link = `${productionUrl}/categories?category=${category.slug}&utm_source=facebook&utm_medium=${targetType}&utm_campaign=${utmCampaign}`;
    }

    return { message, link, imageUrl };
  } catch (error: any) {
    console.error('AI content generation with mascot failed:', error);
    // Fall back to original generator
    return generatePostContent(context, env);
  }
}

/**
 * Build AI prompt based on content type and target
 * Same as original function
 */
function buildPrompt(
  contentType: string,
  targetType: string,
  context: ContentGenerationContext
): string {
  const { business, blogPost, category, siteUrl } = context;

  switch (contentType) {
    case 'business_spotlight':
      if (!business) throw new Error('Business required for business_spotlight');

      const ratingText = business.google_rating
        ? `They've got ${business.google_rating} stars from ${business.google_review_count} reviews`
        : '';

      if (targetType === 'page') {
        return `Share about this awesome local business you discovered:

Business: ${business.name}
Where: ${business.city}, ${business.state}
What they do: ${business.description || 'Local business serving our community'}
${ratingText}

Write like you're genuinely excited to tell people about this place. Start with something that grabbed your attention about them. Keep it real and conversational.

${business.facebook_url
  ? `IMPORTANT: Tag the business using @${business.name.replace(/\s+/g, '')} (remove ALL spaces!)`
  : `Mention ${business.name} naturally but DON'T use @tag since they don't have a Facebook page`
}

Around 80-100 words.`;
      } else {
        // Group post - more casual
        return `Tell the community about ${business.name} in ${business.city}:

${business.description || 'This local business serving our community'}
${ratingText}

Keep it casual like you're telling a friend about a cool discovery. Mention what makes them special. 60-100 words.`;
      }

    case 'blog_share':
      if (!blogPost) throw new Error('Blog post required');
      return `${blogPost.title}

${blogPost.excerpt || ''}

Read the full article at the link below.`;

    case 'category_highlight':
      if (!category) throw new Error('Category required');
      return `Looking for ${category.name} in Southeast Oklahoma?

We've got you covered! Check out these local ${category.name.toLowerCase()} businesses on Kiamichi Biz Connect.

Browse the full directory at the link below.`;

    case 'engagement_prompt':
      // Community engagement questions
      const questions = [
        "What's your favorite local restaurant in Southeast Oklahoma and why?",
        "Which local business always makes you feel welcome when you visit?",
        "If you could recommend one local service to a friend, what would it be?",
        "What's the best customer service experience you've had with a local business?"
      ];
      return questions[Math.floor(Math.random() * questions.length)];

    default:
      throw new Error(`Unsupported content type: ${contentType}`);
  }
}

/**
 * Generate fallback content if AI fails
 */
async function generateFallbackContent(context: ContentGenerationContext): Promise<{ message: string; link: string; imageUrl?: string }> {
  const { contentType, business, blogPost, category } = context;
  
  let message = '';
  let link = '';
  let imageUrl: string | undefined;
  
  switch (contentType) {
    case 'business_spotlight':
      if (!business) throw new Error('Business required');
      
      message = `🌟 Just discovered ${business.name} in ${business.city}! ${business.description || 'Amazing local business'} Check them out!`;
      link = `https://kiamichibizconnect.com/business/${business.slug}`;
      imageUrl = business.image_url || undefined;
      break;
      
    case 'blog_share':
      if (!blogPost) throw new Error('Blog post required');
      message = `📰 New blog post: ${blogPost.title}`;
      link = `https://kiamichibizconnect.com/blog/${blogPost.slug}`;
      imageUrl = blogPost.featured_image || undefined;
      break;
      
    default:
      message = 'Check out this local business!';
      link = 'https://kiamichibizconnect.com';
  }
  
  return { message, link, imageUrl };
}

/**
 * Generate business image using Workers AI
 * Same as original function
 */
async function generateBusinessImage(env: Env, business: any, message: string): Promise<string | undefined> {
  try {
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
      sceneDescription = 'Professional auto mechanic working on vehicle, organized garage, modern tools, clean workspace';
    } else {
      sceneDescription = `Professional ${business.name} business setting, ${business.city}, welcoming atmosphere, quality service, local business`;
    }
    
    const imageResponse = await env.AI.run('@cf/black-forest-labs/flux-1-dev', {
      prompt: sceneDescription,
      guidance: 7.5,
      steps: 20
    });
    
    if (imageResponse && imageResponse.image) {
      const imageBuffer = Buffer.from(imageResponse.image, 'base64');
      const imageKey = `social/ai-generated-${Date.now()}-${business.id}.jpg`;
      
      await env.IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      });
      
      const imageUrl = `${env.SITE_URL}/images/${imageKey}`;
      console.log(`Generated AI image for ${business.name}: ${imageKey}`);
      return imageUrl;
    }
  } catch (error) {
    console.error('AI image generation failed:', error);
  }
  
  return undefined;
}