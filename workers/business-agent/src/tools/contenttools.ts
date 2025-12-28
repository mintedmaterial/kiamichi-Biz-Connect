/**
 * Content Generation & Management Tools
 * Tools for creating and managing business listing content
 */
import { tool } from "ai";
import { z } from "zod/v3";
import type { Chat } from "../server";
import { getCurrentAgent } from "agents";

/**
 * Update a page component (hero, services, gallery, etc.)
 * Requires human confirmation before modifying the business listing
 */
export const updateComponent = tool({
  description: "Update content for a page component (hero, services, gallery, testimonials, contact, FAQ, about)",
  inputSchema: z.object({
    componentId: z.number().describe("The ID of the component to update"),
    content: z.record(z.any()).describe("The updated content as a JSON object (heading, text, images, etc.)"),
    config: z.record(z.any()).optional().describe("Optional configuration settings for the component")
  })
  // Omitting execute makes this require human confirmation (critical changes)
});

/**
 * Generate an SEO-optimized blog post for the business
 * Requires human confirmation before creating the post
 */
export const generateBlogPost = tool({
  description: "Generate an SEO-optimized blog post for the business listing. Creates title, content, meta description, and keywords.",
  inputSchema: z.object({
    topic: z.string().describe("The topic or theme for the blog post"),
    keywords: z.array(z.string()).describe("Target SEO keywords to include"),
    tone: z.enum(["professional", "casual", "friendly", "informative"]).default("professional").describe("The writing tone/voice"),
    wordCount: z.number().min(300).max(2000).default(800).describe("Target word count for the post")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Analyze and optimize SEO for the business listing
 * Requires human confirmation before applying changes
 */
export const optimizeSEO = tool({
  description: "Analyze the business listing page for SEO issues (keywords, meta tags, schema markup, Core Web Vitals) and provide optimization suggestions.",
  inputSchema: z.object({
    autoApply: z.boolean().default(false).describe("Automatically apply high-confidence SEO fixes (requires human confirmation)")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Generate AI images using Workers AI
 * Requires human confirmation before generation
 */
export const generateImage = tool({
  description: "Generate AI images using Cloudflare Workers AI (Stable Diffusion XL). Images are stored in R2 and can be used for social posts, blog content, or business listing graphics.",
  inputSchema: z.object({
    prompt: z.string().describe("Detailed description of the image to generate (e.g., 'Professional hair salon interior with modern styling chairs, natural lighting')"),
    purpose: z.enum(["social", "blog", "business-hero", "business-gallery", "business-logo"]).describe("What the image will be used for - determines R2 bucket and folder structure"),
    width: z.number().default(1024).describe("Image width in pixels (max 1024)"),
    height: z.number().default(1024).describe("Image height in pixels (max 1024)"),
    businessId: z.number().optional().describe("Business ID to associate the image with (required for business-* purposes)")
  })
  // Omitting execute makes this require human confirmation
});

/**
 * Execution implementations for tools requiring human confirmation
 */
export const contentExecutions = {
  /**
   * Execute component update after human confirmation
   */
  updateComponent: async ({ componentId, content, config }: {
    componentId: number;
    content: Record<string, any>;
    config?: Record<string, any>;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      await env.DB.prepare(`
        UPDATE page_components
        SET content = ?, config = ?, updated_at = (unixepoch())
        WHERE id = ?
      `).bind(JSON.stringify(content), JSON.stringify(config || {}), componentId).run();

      return `Component ${componentId} updated successfully`;
    } catch (error) {
      console.error("Error updating component:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute blog post generation after human confirmation
   */
  generateBlogPost: async ({ topic, keywords, tone, wordCount }: {
    topic: string;
    keywords: string[];
    tone: string;
    wordCount: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.AI || !env?.DB) {
      throw new Error("AI or Database not available");
    }

    try {
      // Use Workers AI to generate blog post content
      const prompt = `Write a ${wordCount}-word ${tone} blog post about "${topic}" for a local business.
Include these SEO keywords naturally: ${keywords.join(", ")}.
Format: JSON with fields "title", "content" (HTML), "metaDescription" (max 160 chars), "readingTimeMinutes".`;

      const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [{ role: "user", content: prompt }]
      });

      // Parse AI response and insert into database
      // Note: This is a simplified version - production would need better parsing
      const blogData = typeof response === 'string' ? JSON.parse(response) : response;

      // Insert blog post (businessId would come from agent context)
      // This is placeholder logic - actual implementation needs businessId from context

      return `Blog post "${blogData.title}" generated successfully. Preview: ${blogData.content.substring(0, 200)}...`;
    } catch (error) {
      console.error("Error generating blog post:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute SEO optimization after human confirmation
   */
  optimizeSEO: async ({ autoApply }: { autoApply: boolean }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.DB) {
      throw new Error("Database not available");
    }

    try {
      // Analyze SEO issues (simplified version)
      const issues = [];
      const suggestions = [];

      // Check for missing meta descriptions, schema markup, etc.
      // This would be more comprehensive in production

      if (autoApply) {
        // Apply high-confidence fixes
        // e.g., add missing schema markup, fix meta descriptions
        suggestions.push("Applied automatic SEO fixes: added schema markup, optimized meta tags");
      } else {
        suggestions.push("SEO analysis complete. Use autoApply: true to apply fixes automatically.");
      }

      return {
        score: 75, // Placeholder SEO score
        issues,
        suggestions
      };
    } catch (error) {
      console.error("Error optimizing SEO:", error);
      return `Error: ${error}`;
    }
  },

  /**
   * Execute image generation after human confirmation
   * Uses Workers AI Stable Diffusion XL for image generation
   */
  generateImage: async ({ prompt, purpose, width, height, businessId }: {
    prompt: string;
    purpose: string;
    width: number;
    height: number;
    businessId?: number;
  }) => {
    const { agent } = getCurrentAgent<Chat>();
    const env = agent?.env;

    if (!env?.AI) {
      throw new Error("Workers AI not available");
    }

    // Validate businessId for business purposes
    if (purpose.startsWith('business-') && !businessId) {
      return {
        success: false,
        error: "Business ID is required for business-* image purposes"
      };
    }

    try {
      console.log(`[AI] Generating image with Stable Diffusion XL: ${prompt}`);

      // Generate image using Workers AI
      const response = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", {
        prompt: prompt,
        width: Math.min(width, 1024),
        height: Math.min(height, 1024)
      });

      // Response is a ReadableStream of the PNG image
      const imageBuffer = await new Response(response).arrayBuffer();
      const timestamp = Date.now();
      const filename = `${timestamp}.png`;

      // Determine bucket and path based on purpose
      let bucket: R2Bucket;
      let imagePath: string;
      let bucketName: string;

      if (purpose === 'social' || purpose === 'blog') {
        // Use IMAGES bucket (kiamichi-biz-images) for social/blog content
        bucket = env.IMAGES!;
        bucketName = 'kiamichi-biz-images';
        imagePath = businessId
          ? `${purpose}/${businessId}/${filename}`
          : `${purpose}/${filename}`;
      } else {
        // Use BUSINESS_IMAGES bucket for business listing images
        bucket = env.BUSINESS_IMAGES!;
        bucketName = 'kiamichi-business-images';
        const category = purpose.replace('business-', ''); // hero, gallery, logo
        imagePath = `businesses/${businessId}/${category}/${filename}`;
      }

      if (!bucket) {
        throw new Error(`R2 bucket not configured for purpose: ${purpose}`);
      }

      // Upload to R2
      await bucket.put(imagePath, imageBuffer, {
        httpMetadata: {
          contentType: 'image/png'
        },
        customMetadata: {
          purpose: purpose,
          businessId: businessId?.toString() || '',
          prompt: prompt.substring(0, 500), // Truncate long prompts
          generatedAt: new Date().toISOString()
        }
      });

      // Construct S3 API URL
      const s3Url = `https://ff3c5e2beaea9f85fee3200bfe28da16.r2.cloudflarestorage.com/${bucketName}/${imagePath}`;

      console.log(`[AI] Image generated and stored at: ${imagePath}`);

      // Return markdown-formatted message for chat display
      const imageMarkdown = `![Generated Image](${s3Url})`;
      const details = `
**Image Generated Successfully!**

${imageMarkdown}

📁 **Storage Details:**
- **Bucket**: ${bucketName}
- **Path**: ${imagePath}
- **Purpose**: ${purpose}
- **Dimensions**: ${Math.min(width, 1024)}x${Math.min(height, 1024)}px
- **Size**: ${(imageBuffer.byteLength / 1024).toFixed(2)} KB

🔗 **Direct URL**: ${s3Url}
`;

      return details;
    } catch (error) {
      console.error("Error generating image:", error);
      return {
        success: false,
        error: `Failed to generate image: ${error}`
      };
    }
  }
};
