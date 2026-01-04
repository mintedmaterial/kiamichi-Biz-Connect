// Enhanced Facebook content generator with image strategy
// 2/3 business photos, 1/3 AI generated images

import type { Env, Business, BlogPost, Category } from './types';

export async function generatePostWithImageStrategy(
  env: Env,
  contentType: 'business_spotlight' | 'blog_share' | 'category_highlight' | 'engagement_prompt',
  business?: Business,
  blogPost?: BlogPost,
  category?: Category
): Promise<{
  message: string;
  imageUrl?: string;
  link?: string;
  shouldGenerateImage: boolean;
}> {
  
  // Generate the text content first
  const { generatePostContent } = await import('./facebook-content-generator');
  const message = await generatePostContent(env, contentType, business, blogPost, category);
  
  // Determine image strategy based on content type and random chance
  let shouldGenerateImage = false;
  let imageUrl: string | undefined;
  
  // For business spotlights: 2/3 use business photo, 1/3 generate new image
  if (contentType === 'business_spotlight' && business) {
    if (Math.random() < 0.67) {
      // 67% chance: Use business photo if available
      if (business.image_url) {
        imageUrl = business.image_url;
        shouldGenerateImage = false;
      } else {
        // No business photo, fallback to generation
        shouldGenerateImage = true;
      }
    } else {
      // 33% chance: Generate new image
      shouldGenerateImage = true;
    }
  }
  
  // For other content types: 50/50 split
  else if (contentType === 'category_highlight' || contentType === 'engagement_prompt') {
    shouldGenerateImage = Math.random() < 0.5;
  }
  
  // Blog shares: Use blog featured image if available, otherwise generate
  else if (contentType === 'blog_share' && blogPost?.featured_image) {
    imageUrl = blogPost.featured_image;
    shouldGenerateImage = false;
  }
  
  // Generate image if needed
  if (shouldGenerateImage) {
    imageUrl = await generateBusinessImage(env, contentType, business, category, message);
  }
  
  // Generate link with UTM tracking
  const link = business ? 
    `${env.SITE_URL}/business/${business.slug}?utm_source=facebook&utm_medium=auto&utm_campaign=${contentType}` :
    undefined;
  
  return {
    message,
    imageUrl,
    link,
    shouldGenerateImage
  };
}

async function generateBusinessImage(
  env: Env,
  contentType: string,
  business?: Business,
  category?: Category,
  message?: string
): Promise<string | undefined> {
  try {
    // Generate image prompt based on business/category
    let imagePrompt = '';
    
    if (business) {
      const businessType = (business.description || '').toLowerCase();
      const location = `${business.city}, ${business.state}`;
      
      if (businessType.includes('electric') || businessType.includes('electrician')) {
        imagePrompt = `Professional electrician working on an electrical panel, modern home, safety gear, organized tools, bright lighting, professional setting, ${location}`;
      } else if (businessType.includes('plumb')) {
        imagePrompt = `Skilled plumber repairing pipes, professional tools, clean modern setting, natural lighting, ${location}`;
      } else if (businessType.includes('hair') || businessType.includes('salon') || businessType.includes('beauty')) {
        imagePrompt = `Professional hair stylist in modern salon, natural lighting, clean contemporary interior, styling tools, ${location}`;
      } else if (businessType.includes('restaurant') || businessType.includes('food') || businessType.includes('diner')) {
        imagePrompt = `Delicious plated food, cozy restaurant atmosphere, warm ambient lighting, inviting setting, fresh ingredients, ${location}`;
      } else if (businessType.includes('auto') || businessType.includes('mechanic')) {
        imagePrompt = `Professional auto mechanic working on vehicle, organized garage, modern tools, clean workspace, ${location}`;
      } else {
        // Generic business image
        imagePrompt = `Professional ${business.name} business setting, ${location}, welcoming atmosphere, quality service, local business`;
      }
    } else if (category) {
      imagePrompt = `${category.name} services in Southeast Oklahoma, professional setting, local business, quality service`;
    } else {
      imagePrompt = `Southeast Oklahoma local business, community focused, professional service, welcoming atmosphere`;
    }
    
    // Generate image using Workers AI
    const imageResponse = await env.AI.run('@cf/black-forest-labs/flux-1-dev', {
      prompt: imagePrompt,
      guidance: 7.5,
      steps: 20
    });
    
    if (imageResponse && imageResponse.image) {
      // Upload to R2 bucket
      const imageBuffer = Buffer.from(imageResponse.image, 'base64');
      const imageKey = `facebook-generated/${Date.now()}-${contentType}-${business?.id || 'general'}.jpg`;
      
      await env.IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/jpeg',
        },
      });
      
      // Return public URL
      return `${env.SITE_URL}/images/${imageKey}`;
    }
    
  } catch (error) {
    console.error('Image generation failed:', error);
  }
  
  return undefined;
}

// Export for use in scheduler
export { generatePostWithImageStrategy };