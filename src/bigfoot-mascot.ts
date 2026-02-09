// Bigfoot Jr. Mascot Image Generation System
// Integrates Bigfoot mascot into business images for Kiamichi Biz Connect

import type { Env } from './types';

export interface MascotConfig {
  name: string;
  style: 'cartoon' | 'realistic' | 'stylized';
  appearance: {
    color: string;
    size: 'small' | 'medium' | 'large';
    pose: 'friendly' | 'professional' | 'playful';
  };
  frequency: number; // 0-1, how often to include mascot (0.3 = 30% of images)
}

const BIGFOOT_MASCOT: MascotConfig = {
  name: 'Bigfoot Jr.',
  style: 'cartoon',
  appearance: {
    color: 'warm brown with cream accents',
    size: 'medium',
    pose: 'friendly'
  },
  frequency: 0.3 // Include in 30% of generated images
};

/**
 * Generate business image with Bigfoot mascot integration
 */
export async function generateBusinessImageWithMascot(
  env: Env,
  businessType: string,
  location: string,
  businessName: string,
  includeMascot: boolean = false
): Promise<string | undefined> {
  try {
    let imagePrompt = '';
    
    // Base business-specific prompt
    const businessTypeLower = businessType.toLowerCase();
    
    if (businessTypeLower.includes('restaurant') || businessTypeLower.includes('food') || businessTypeLower.includes('diner')) {
      imagePrompt = `Cozy ${location} restaurant interior, warm lighting, delicious plated food, professional presentation, welcoming atmosphere`;
    } else if (businessTypeLower.includes('hair') || businessTypeLower.includes('salon') || businessTypeLower.includes('beauty')) {
      imagePrompt = `Modern ${location} hair salon, professional stylist, clean contemporary interior, natural lighting, styling tools visible`;
    } else if (businessTypeLower.includes('electric') || businessTypeLower.includes('electrician')) {
      imagePrompt = `Professional electrician in ${location}, modern workshop, organized tools, safety equipment, bright lighting`;
    } else if (businessTypeLower.includes('plumb')) {
      imagePrompt = `Skilled plumber working in ${location}, professional tools, clean modern setting, organized workspace`;
    } else if (businessTypeLower.includes('auto') || businessTypeLower.includes('mechanic')) {
      imagePrompt = `Professional auto mechanic in ${location}, organized garage, modern tools, clean workspace`;
    } else {
      imagePrompt = `Professional ${businessName} business in ${location}, welcoming atmosphere, quality service, local community business`;
    }
    
    // Add Bigfoot mascot if requested
    if (includeMascot) {
      imagePrompt += `, featuring Bigfoot Jr., a friendly cartoon bigfoot character with warm brown fur and cream accents, ${BIGFOOT_MASCOT.appearance.pose} pose, integrated naturally into the scene`;
    }
    
    // Add quality and style specifications
    imagePrompt += `, high quality, professional photography style, well lit, appealing composition`;
    
    console.log("[Mascot Image] Generating with prompt:", imagePrompt);
    
    // Generate image using Workers AI
    const imageResponse = await env.AI.run('@cf/black-forest-labs/flux-1-dev', {
      prompt: imagePrompt,
      guidance: 7.5,
      steps: 20,
      strength: 0.8
    });
    
    if (imageResponse && imageResponse.image) {
      // Upload to R2 bucket
      const imageBuffer = Buffer.from(imageResponse.image, 'base64');
      const timestamp = Date.now();
      const imageKey = `social/business-${businessName.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.jpg`;
      
      await env.IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
        customMetadata: {
          businessName: businessName,
          businessType: businessType,
          location: location,
          hasMascot: includeMascot.toString(),
          generatedAt: new Date().toISOString()
        }
      });
      
      // Store in social_media_images table
      const imageUrl = `${env.SITE_URL}/images/${imageKey}`;
      
      await env.DB.prepare(`
        INSERT INTO social_media_images 
        (image_key, image_url, image_prompt, business_id, content_type, platform, generated_at, model, width, height, is_approved, quality_score, created_at)
        VALUES (?, ?, ?, ?, 'business_highlight', 'facebook', ?, 'flux-1-dev', 1024, 1024, 1, 85, ?)
      `).bind(
        imageKey,
        imageUrl,
        imagePrompt,
        businessId, // You'll need to pass this
        new Date().toISOString(),
        new Date().toISOString()
      ).run();
      
      console.log("[Mascot Image] Generated and stored:", imageKey);
      return imageUrl;
    }
    
  } catch (error) {
    console.error("[Mascot Image] Generation failed:", error);
  }
  
  return undefined;
}

/**
 * Determine if mascot should be included based on frequency and content type
 */
export function shouldIncludeMascot(
  contentType: 'business_spotlight' | 'blog_share' | 'category_highlight' | 'engagement_prompt',
  businessId?: number,
  lastMascotUse?: number
): boolean {
  // Don't include mascot in blog shares or engagement prompts
  if (contentType === 'blog_share' || contentType === 'engagement_prompt') {
    return false;
  }
  
  // For business spotlights, use frequency-based inclusion
  if (contentType === 'business_spotlight') {
    // Check if enough time has passed since last mascot use
    if (lastMascotUse && (Date.now() - lastMascotUse) < 24 * 60 * 60 * 1000) {
      return false; // Don't use mascot more than once per day per business
    }
    
    // Use frequency setting (30% chance)
    return Math.random() < BIGFOOT_MASCOT.frequency;
  }
  
  // For other content types, use lower frequency
  return Math.random() < (BIGFOOT_MASCOT.frequency * 0.5);
}

/**
 * Get creative social media prompts featuring Bigfoot mascot
 */
export function getMascotSocialPrompts(businessName: string, businessType: string): string[] {
  return [
    `🦶 Bigfoot Jr. spotted at ${businessName}! This local ${businessType} is making waves in our community. Check out what makes them special!`,
    `Our friendly neighborhood Bigfoot Jr. gives ${businessName} two big hairy thumbs up! 👍👍 Discover why locals love this ${businessType}.`,
    `🌲 Bigfoot Jr.'s business spotlight: ${businessName}! When even our elusive mascot can't resist stopping by, you know it's good!`,
    `Guess who Bigfoot Jr. found? ${businessName}! This amazing local ${businessType} is worth the trek through the Kiamichi forests.`,
    `Bigfoot Jr. says: "Don't let this ${businessType} stay hidden like me!" Check out ${businessName} - our community's best kept secret!`
  ];
}

/**
 * Enhanced business spotlight with mascot integration
 */
export async function generateBusinessSpotlightWithMascot(
  env: Env,
  business: any, // Business object
  includeMascot: boolean = false
): Promise<{
  message: string;
  imageUrl?: string;
  shouldIncludeMascot: boolean;
}> {
  // Determine if we should include mascot
  const includeMascotInImage = shouldIncludeMascot('business_spotlight', business.id);
  
  // Generate creative message
  const mascotPrompts = getMascotSocialPrompts(business.name, business.description || 'local business');
  const selectedPrompt = mascotPrompts[Math.floor(Math.random() * mascotPrompts.length)];
  
  // Generate image with mascot if appropriate
  let imageUrl: string | undefined;
  if (includeMascotInImage) {
    imageUrl = await generateBusinessImageWithMascot(
      env,
      business.description || 'local business',
      business.city || 'Southeast Oklahoma',
      business.name,
      true
    );
  }
  
  return {
    message: selectedPrompt,
    imageUrl,
    shouldIncludeMascot: includeMascotInImage
  };
}