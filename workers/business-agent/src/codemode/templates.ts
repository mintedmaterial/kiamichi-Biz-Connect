/**
 * Code Mode Templates for Business Agent
 * 
 * Template-based execution for batch operations on business listings.
 * LLM selects template + params, we execute predefined operation sequences.
 */

import { Env } from '../types';

/**
 * Tool functions for Code Mode operations
 */
export function createBusinessTools(env: Env, businessId: number) {
  return {
    /**
     * Get business details
     */
    async getBusinessInfo() {
      const business = await env.DB.prepare(`
        SELECT b.*, lp.id as listing_page_id, lp.seo_title, lp.seo_description, 
               lp.is_published, lp.layout_version
        FROM businesses b
        LEFT JOIN listing_pages lp ON b.id = lp.business_id
        WHERE b.id = ?
      `).bind(businessId).first();
      return business;
    },

    /**
     * Get all page components
     */
    async getPageComponents() {
      const { results } = await env.DB.prepare(`
        SELECT pc.* FROM page_components pc
        JOIN listing_pages lp ON pc.listing_page_id = lp.id
        WHERE lp.business_id = ?
        ORDER BY pc.display_order
      `).bind(businessId).all();
      return results;
    },

    /**
     * Update a component's content
     */
    async updateComponent({ componentId, content, config }: {
      componentId: number;
      content: Record<string, any>;
      config?: Record<string, any>;
    }) {
      const updates: string[] = [];
      const values: any[] = [];

      if (content) {
        updates.push('content = ?');
        values.push(JSON.stringify(content));
      }
      if (config) {
        updates.push('config = ?');
        values.push(JSON.stringify(config));
      }
      updates.push('updated_at = unixepoch()');
      values.push(componentId);

      await env.DB.prepare(`
        UPDATE page_components SET ${updates.join(', ')} WHERE id = ?
      `).bind(...values).run();

      return { updated: true, componentId };
    },

    /**
     * Generate content using Workers AI
     */
    async generateContent({ prompt, type }: { prompt: string; type: string }) {
      const systemPrompt = type === 'description' 
        ? 'You write compelling business descriptions. Be concise and professional.'
        : type === 'tagline'
        ? 'You write catchy taglines. Keep it under 10 words.'
        : 'You write helpful business content.';

      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500
      });

      return { content: (response as any).response || '', type };
    },

    /**
     * Queue a Facebook post
     */
    async queueFacebookPost({ content, scheduledFor }: { 
      content: string; 
      scheduledFor?: string;
    }) {
      const scheduled = scheduledFor ? new Date(scheduledFor).getTime() / 1000 : null;
      
      await env.DB.prepare(`
        INSERT INTO social_queue (business_id, platform, content, scheduled_for, status, created_at)
        VALUES (?, 'facebook', ?, ?, 'pending', unixepoch())
      `).bind(businessId, content, scheduled).run();

      return { queued: true, platform: 'facebook' };
    },

    /**
     * Get pending social posts
     */
    async getPendingSocialPosts() {
      const { results } = await env.DB.prepare(`
        SELECT * FROM social_queue 
        WHERE business_id = ? AND status = 'pending'
        ORDER BY scheduled_for
      `).bind(businessId).all();
      return results;
    },

    /**
     * Update SEO metadata
     */
    async updateSEO({ title, description, keywords }: {
      title?: string;
      description?: string;
      keywords?: string[];
    }) {
      const updates: string[] = [];
      const values: any[] = [];

      if (title) {
        updates.push('seo_title = ?');
        values.push(title);
      }
      if (description) {
        updates.push('seo_description = ?');
        values.push(description);
      }
      if (keywords) {
        updates.push('seo_keywords = ?');
        values.push(JSON.stringify(keywords));
      }
      
      if (updates.length === 0) return { updated: false };
      
      updates.push('updated_at = unixepoch()');
      values.push(businessId);

      await env.DB.prepare(`
        UPDATE listing_pages SET ${updates.join(', ')} WHERE business_id = ?
      `).bind(...values).run();

      return { updated: true, fields: updates.length - 1 };
    }
  };
}

type BusinessTools = ReturnType<typeof createBusinessTools>;

/**
 * Operation templates
 */
export const BUSINESS_TEMPLATES = {
  /**
   * Refresh all page content - regenerate descriptions, update components
   */
  'refresh-content': async (tools: BusinessTools, params: { style?: string }) => {
    const business = await tools.getBusinessInfo();
    if (!business) return { error: 'Business not found' };

    const components = await tools.getPageComponents();
    let updated = 0;

    // Generate new tagline
    const tagline = await tools.generateContent({
      prompt: `Write a tagline for ${business.name}, a business in ${business.city}, ${business.state}. ${business.description || ''}`,
      type: 'tagline'
    });

    // Update hero component if exists
    const heroComponent = components.find((c: any) => c.component_type === 'hero');
    if (heroComponent && tagline.content) {
      const content = JSON.parse(heroComponent.content || '{}');
      content.tagline = tagline.content;
      await tools.updateComponent({
        componentId: heroComponent.id,
        content
      });
      updated++;
    }

    // Generate new description if needed
    if (!business.description || business.description.length < 50) {
      const desc = await tools.generateContent({
        prompt: `Write a professional description for ${business.name} in ${business.city}, ${business.state}. Category: ${business.category_id}. Style: ${params.style || 'professional'}`,
        type: 'description'
      });
      
      // Update about component if exists
      const aboutComponent = components.find((c: any) => c.component_type === 'about');
      if (aboutComponent && desc.content) {
        const content = JSON.parse(aboutComponent.content || '{}');
        content.description = desc.content;
        await tools.updateComponent({
          componentId: aboutComponent.id,
          content
        });
        updated++;
      }
    }

    return { 
      success: true, 
      updated, 
      business: business.name,
      tagline: tagline.content
    };
  },

  /**
   * Optimize SEO - update meta tags, titles, descriptions
   */
  'optimize-seo': async (tools: BusinessTools, params: { keywords?: string[] }) => {
    const business = await tools.getBusinessInfo();
    if (!business) return { error: 'Business not found' };

    // Generate SEO-optimized title
    const titlePrompt = `Write an SEO title (50-60 chars) for: ${business.name} - ${business.city}, ${business.state}`;
    const titleResult = await tools.generateContent({ prompt: titlePrompt, type: 'title' });

    // Generate meta description
    const descPrompt = `Write an SEO meta description (150-160 chars) for: ${business.name}. ${business.description || ''}`;
    const descResult = await tools.generateContent({ prompt: descPrompt, type: 'description' });

    // Generate keywords if not provided
    const keywords = params.keywords || [
      business.name,
      business.city,
      business.state,
      'local business'
    ];

    await tools.updateSEO({
      title: titleResult.content,
      description: descResult.content,
      keywords
    });

    return {
      success: true,
      title: titleResult.content,
      description: descResult.content,
      keywords
    };
  },

  /**
   * Schedule social posts - create a week of Facebook content
   */
  'schedule-social': async (tools: BusinessTools, params: { days?: number }) => {
    const business = await tools.getBusinessInfo();
    if (!business) return { error: 'Business not found' };

    const days = params.days || 7;
    const posts: { day: number; content: string }[] = [];

    for (let i = 1; i <= Math.min(days, 7); i++) {
      const prompt = `Write a short Facebook post (under 100 words) for ${business.name} in ${business.city}. Day ${i} of the week. Be engaging and include a call to action.`;
      const result = await tools.generateContent({ prompt, type: 'social' });
      
      const scheduledFor = new Date();
      scheduledFor.setDate(scheduledFor.getDate() + i);
      scheduledFor.setHours(12, 0, 0, 0); // Noon each day

      await tools.queueFacebookPost({
        content: result.content,
        scheduledFor: scheduledFor.toISOString()
      });

      posts.push({ day: i, content: result.content });
    }

    return {
      success: true,
      scheduled: posts.length,
      posts
    };
  },

  /**
   * Audit listing - check completeness and suggest improvements
   */
  'audit-listing': async (tools: BusinessTools, _params: {}) => {
    const business = await tools.getBusinessInfo();
    if (!business) return { error: 'Business not found' };

    const components = await tools.getPageComponents();
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check business info completeness
    if (!business.description) issues.push('Missing business description');
    if (!business.phone) issues.push('Missing phone number');
    if (!business.email) issues.push('Missing email');
    if (!business.website) issues.push('Missing website');
    if (!business.seo_title) issues.push('Missing SEO title');
    if (!business.seo_description) issues.push('Missing SEO description');

    // Check components
    const componentTypes = components.map((c: any) => c.component_type);
    if (!componentTypes.includes('hero')) suggestions.push('Add a hero section');
    if (!componentTypes.includes('contact')) suggestions.push('Add a contact section');
    if (!componentTypes.includes('services') && !componentTypes.includes('about')) {
      suggestions.push('Add services or about section');
    }

    // Generate improvement suggestions
    if (issues.length > 0) {
      suggestions.push('Run "optimize-seo" to fix SEO issues');
    }
    if (components.length < 3) {
      suggestions.push('Add more components to enrich the listing');
    }

    return {
      business: business.name,
      completeness: Math.round((1 - issues.length / 6) * 100),
      issues,
      suggestions,
      componentCount: components.length
    };
  }
};

export type TemplateName = keyof typeof BUSINESS_TEMPLATES;

/**
 * Execute a Code Mode template
 */
export async function executeTemplate(
  env: Env,
  businessId: number,
  templateName: TemplateName,
  params: Record<string, any> = {}
): Promise<{
  success: boolean;
  template: string;
  result: any;
  error?: string;
}> {
  console.log(`[CodeMode] Executing template: ${templateName} for business ${businessId}`);

  const tools = createBusinessTools(env, businessId);
  const template = BUSINESS_TEMPLATES[templateName];

  if (!template) {
    return {
      success: false,
      template: templateName,
      result: null,
      error: `Unknown template: ${templateName}`
    };
  }

  try {
    const result = await template(tools, params);
    console.log(`[CodeMode] Template ${templateName} completed:`, result);
    return {
      success: true,
      template: templateName,
      result
    };
  } catch (error) {
    console.error(`[CodeMode] Template ${templateName} failed:`, error);
    return {
      success: false,
      template: templateName,
      result: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
