/**
 * Facebook & Social Media Tools
 * Tools for posting to Facebook and other social media platforms
 */
import { tool } from "ai";
import { z } from "zod/v3";
import type { Chat } from "../server";
import { Agent, getCurrentAgent } from "agents";

/**
 * STEP 1: Generate social media post text
 * Auto-executes without confirmation (just generates text, doesn't post)
 */
export const generateSocialPostDraft = tool({
  description: "Generate engaging social media post text for a business. Creates compelling copy with hashtags and CTAs. Does NOT post - just generates the text.",
  inputSchema: z.object({
    businessName: z.string().describe("The business name to create content for"),
    platform: z.enum(["facebook", "instagram", "twitter"]).default("facebook").describe("The social media platform"),
    tone: z.enum(["professional", "casual", "friendly", "promotional"]).default("friendly"),
    includeHashtags: z.boolean().default(true).describe("Whether to include hashtags")
  }),
  execute: async ({ businessName, platform, tone, includeHashtags }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB || !env?.AI) {
      throw new Error("Database or AI not available");
    }

    try {
      // Fetch business details from database
      const business = await env.DB.prepare(`
        SELECT * FROM businesses WHERE name LIKE ? LIMIT 1
      `).bind(`%${businessName}%`).first();

      if (!business) {
        return `Business "${businessName}" not found in database. Please check the name and try again.`;
      }

      // Generate post text using Workers AI
      const systemPrompt = `You are a friendly, enthusiastic local community member who loves supporting small businesses in southeastern Oklahoma. Write engaging, human-like social media posts.

BUSINESS INFO:
- Name: ${business.name}
- City: ${business.city}, ${business.state}
- Description: ${business.description || 'Local business'}
- Phone: ${business.phone || 'N/A'}
${business.facebook_url ? `- Facebook: ${business.facebook_url}` : ''}

TONE: ${tone}

BUSINESS MENTIONS:
${business.facebook_url
  ? `- ${business.name} has a Facebook page - TAG them in your message
- IMPORTANT: Remove ALL spaces from the business name when @tagging
- Example: "@${business.name.replace(/\s+/g, '')}" (no spaces!)
- Place the @tag naturally in your message`
  : `- Mention ${business.name} by name naturally in conversation
- Don't use @tag since they don't have a Facebook page we follow`
}

STYLE GUIDE:
- Write like you're texting a friend about a cool place you discovered
- Use conversational language, emojis (2-3 max), and genuine excitement
- 80-120 words
- Include specific details about the business
- Natural hooks like "Y'all, I just found..." or "Had to share this..."
${includeHashtags ? '- End with 2-4 relevant hashtags' : '- No hashtags'}
- For Facebook: Casual, warm, personal recommendation tone`;

      const userPrompt = `Write a ${platform} post about ${business.name} in ${business.city}.

${business.facebook_url
  ? `IMPORTANT: Tag the business by writing @${business.name.replace(/\s+/g, '')} (remove all spaces!) somewhere naturally in your post.`
  : `Mention ${business.name} naturally but DON'T use @tag.`
}

Make it feel authentic and excited, like you're genuinely recommending this place to friends.`;

      const response = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 300
      });

      const postText = typeof response === 'object' && 'response' in response
        ? response.response
        : String(response);

      console.log(`[DRAFT] Generated post text for ${business.name}`);

      return {
        success: true,
        businessId: business.id,
        businessName: business.name,
        postText: postText.trim(),
        platform,
        message: `✅ Post draft created!\n\n---\n${postText.trim()}\n---\n\nNext steps:\n1. Generate an image for this post\n2. Review and publish`
      };
    } catch (error) {
      console.error("Error generating post draft:", error);
      return `Error generating post: ${error}`;
    }
  }
});

/**
 * STEP 2: Generate image for social media post
 * Auto-executes without confirmation (just generates image, doesn't post)
 */
export const generateSocialImage = tool({
  description: "Generate an AI image for a social media post about a business. Creates professional photography-style images (NOT social media mockups).",
  inputSchema: z.object({
    businessId: z.number().describe("The business ID to generate an image for"),
    postText: z.string().describe("The post text to base the image on"),
    style: z.enum(["photography", "illustration", "modern", "vintage"]).default("photography")
  }),
  execute: async ({ businessId, postText, style }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB || !env?.AI || !env?.IMAGES) {
      throw new Error("Database, AI, or R2 storage not available");
    }

    try {
      // Fetch business details
      const business = await env.DB.prepare(`
        SELECT * FROM businesses WHERE id = ?
      `).bind(businessId).first();

      if (!business) {
        return `Business with ID ${businessId} not found`;
      }

      // Generate image prompt based on business type and post content
      const imageSystemPrompt = `You are an expert photographer and visual designer. Based on a business and social media post, create a detailed photography prompt for AI image generation.

REQUIREMENTS:
- Professional photography style (NOT social media mockups or text overlays)
- Real-world scenes featuring the business type
- Natural lighting and composition
- Focus on the service/product, not generic stock photos
- NO text, NO logos, NO social media UI elements
- Describe realistic scenes a photographer would capture

BUSINESS: ${business.name}
CATEGORY: ${business.description || 'Local business'}
LOCATION: ${business.city}, ${business.state}

OUTPUT: Return ONLY the image generation prompt, nothing else.`;

      const imageUserPrompt = `Based on this social media post, create a photography prompt:

"${postText.substring(0, 300)}"

Generate a prompt for a ${style} style photograph that would accompany this post. Focus on the actual business service/product in a real-world setting.`;

      const promptResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
        messages: [
          { role: "system", content: imageSystemPrompt },
          { role: "user", content: imageUserPrompt }
        ],
        temperature: 0.7,
        max_tokens: 150
      });

      const imagePrompt = typeof promptResponse === 'object' && 'response' in promptResponse
        ? promptResponse.response
        : String(promptResponse);

      console.log(`[IMAGE] Generating image with prompt: ${imagePrompt.substring(0, 100)}...`);

      // Generate image using Workers AI
      // Both flux-1-schnell and flux-2-dev return { image: "base64_string" }
      const imageResponse = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", {
        prompt: imagePrompt.trim()
      });

      // Extract base64 image from response
      const imageBase64 = (imageResponse as any).image;
      if (!imageBase64) {
        throw new Error('No image data in AI response');
      }

      // Convert base64 to buffer
      const imageBuffer = Uint8Array.from(atob(imageBase64), (c) => c.codePointAt(0)!);

      // Store in R2
      const timestamp = Date.now();
      const imageKey = `businesses/${businessId}/social/${timestamp}.png`;

      await env.IMAGES.put(imageKey, imageBuffer, {
        httpMetadata: {
          contentType: 'image/png'
        },
        customMetadata: {
          businessId: String(businessId),
          businessName: business.name,
          generatedAt: new Date().toISOString(),
          prompt: imagePrompt.substring(0, 500)
        }
      });

      const imageUrl = `https://kiamichibizconnect.com/images/${imageKey}`;

      // Store metadata in D1
      await env.DB.prepare(`
        INSERT INTO social_media_images
        (image_key, image_url, image_prompt, business_id, content_type, platform, generated_at, model, width, height, is_approved, quality_score, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 85, ?)
      `).bind(
        imageKey,
        imageUrl,
        imagePrompt,
        businessId,
        'post',
        'facebook',
        timestamp,
        'flux-1-schnell',
        1024,
        1024,
        Math.floor(timestamp / 1000)
      ).run();

      console.log(`[IMAGE] Successfully generated and stored image: ${imageUrl}`);

      return {
        success: true,
        imageUrl,
        imagePrompt: imagePrompt.trim(),
        businessId,
        message: `✅ Image generated successfully!\n\n🖼️ Image URL: ${imageUrl}\n📝 Prompt: ${imagePrompt.substring(0, 100)}...\n\nNext step: Publish the post with this image`
      };
    } catch (error) {
      console.error("Error generating image:", error);
      return `Error generating image: ${error}`;
    }
  }
});

/**
 * STEP 3: Publish social media post to Facebook
 * Requires human confirmation before posting
 */
export const publishSocialPost = tool({
  description: "Publish a social media post to Facebook with text and optional image. Requires user confirmation before posting.",
  inputSchema: z.object({
    postText: z.string().describe("The post text/message"),
    imageUrl: z.string().optional().describe("Optional image URL to include"),
    target: z.enum(["page", "group", "both"]).default("page").describe("Where to post: page, group, or both")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Export executions for tools requiring confirmation
 */
export const facebookToolExecutions = {
  /**
   * Execute social post publishing after human confirmation
   * Queues the post in facebook_content_queue - the Facebook worker will publish it
   */
  publishSocialPost: async ({ postText, imageUrl, target }: {
    postText: string;
    imageUrl?: string;
    target: "page" | "group" | "both";
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      console.log(`[PUBLISH] Queuing post for ${target}`);

      // Generate content hash for deduplication
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(postText)
      ).then(buf =>
        Array.from(new Uint8Array(buf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('')
      );

      // Insert into facebook_content_queue table
      // The Facebook worker will pick it up and post using the SAME mechanism that was working
      const now = Math.floor(Date.now() / 1000);

      await env.DB.prepare(`
        INSERT INTO facebook_content_queue (
          content_type,
          target_type,
          message,
          image_url,
          scheduled_for,
          status,
          priority,
          content_hash,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        'business_spotlight',
        target,
        postText,
        imageUrl || null,
        now, // Post immediately
        'pending',
        1, // High priority for on-demand posts
        contentHash,
        now
      ).run();

      console.log(`[PUBLISH] Post queued successfully with hash: ${contentHash.substring(0, 16)}`);

      // Trigger the Facebook worker to process the queue immediately
      if (env.FACEBOOK_WORKER) {
        try {
          // Call the scheduled handler to process pending posts
          const triggerResponse = await env.FACEBOOK_WORKER.fetch(
            new Request("https://facebook-worker/trigger-queue", {
              method: "POST"
            })
          );

          if (triggerResponse.ok) {
            const result = await triggerResponse.json() as any;
            console.log(`[PUBLISH] Queue processing triggered:`, result);

            return `✅ Post queued for Facebook!\n\n` +
                   `📝 Message: ${postText.substring(0, 100)}${postText.length > 100 ? '...' : ''}\n` +
                   `🎯 Target: ${target}\n` +
                   `${imageUrl ? `🖼️ Image: ${imageUrl}\n` : ''}` +
                   `\n⏱️ The Facebook worker will publish this shortly using the working token.\n` +
                   `${result.posted ? `\n✨ Post published! Post ID: ${result.pagePostId || result.groupPostId}` : ''}`;
          } else {
            return `✅ Post queued for Facebook!\n\n` +
                   `The post will be published on the next scheduled run (within 1 hour).\n\n` +
                   `Target: ${target}\n` +
                   `${imageUrl ? `Image: ${imageUrl}` : ''}`;
          }
        } catch (triggerError) {
          console.warn('[PUBLISH] Could not trigger immediate processing:', triggerError);
          return `✅ Post queued for Facebook!\n\n` +
                 `The post will be published on the next scheduled run.\n\n` +
                 `Target: ${target}\n` +
                 `${imageUrl ? `Image: ${imageUrl}` : ''}`;
        }
      }

      return `✅ Post queued for Facebook!\n\n` +
             `Target: ${target}\n` +
             `${imageUrl ? `Image: ${imageUrl}` : ''}`;
    } catch (error) {
      console.error("Error queuing post:", error);
      return `Error queuing post: ${error}`;
    }
  }
};
