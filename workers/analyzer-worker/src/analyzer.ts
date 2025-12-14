/**
 * Core AI analysis functions
 */

import { Business, Env } from './types';

/**
 * Analyze business completeness score (0-100)
 */
export function analyzeCompleteness(business: Business): number {
  let score = 0;
  const fields = [
    { key: 'name', weight: 10 },
    { key: 'description', weight: 15 },
    { key: 'phone', weight: 10 },
    { key: 'email', weight: 10 },
    { key: 'website', weight: 10 },
    { key: 'address_line1', weight: 10 },
    { key: 'city', weight: 5 },
    { key: 'state', weight: 5 },
    { key: 'zip_code', weight: 5 },
    { key: 'facebook_url', weight: 5 },
    { key: 'image_url', weight: 10 },
    { key: 'hours', weight: 5 }
  ];

  for (const field of fields) {
    const value = (business as any)[field.key];
    if (value && value !== null && String(value).trim().length > 0) {
      score += field.weight;
    }
  }

  return Math.min(100, score);
}

/**
 * Generate enrichment plan using AI
 */
export async function generateEnrichmentPlan(
  business: Business,
  env: Env
): Promise<Array<{ field: string; reasoning: string }>> {
  const missingFields: Array<{ field: string; reasoning: string }> = [];

  // Check which fields are missing
  if (!business.description || business.description.trim().length < 20) {
    missingFields.push({
      field: 'description',
      reasoning: 'Business needs a compelling description for SEO and user engagement'
    });
  }

  if (!business.phone) {
    missingFields.push({
      field: 'phone',
      reasoning: 'Phone number is essential for customer contact'
    });
  }

  if (!business.email) {
    missingFields.push({
      field: 'email',
      reasoning: 'Email provides an alternative contact method'
    });
  }

  if (!business.website) {
    missingFields.push({
      field: 'website',
      reasoning: 'Website helps customers learn more about the business'
    });
  }

  if (!business.hours) {
    missingFields.push({
      field: 'hours',
      reasoning: 'Business hours help customers know when to visit'
    });
  }

  if (!business.image_url && !business.facebook_image_url) {
    missingFields.push({
      field: 'image_url',
      reasoning: 'Professional image improves listing visibility and trust'
    });
  }

  if (!business.facebook_url) {
    missingFields.push({
      field: 'facebook_url',
      reasoning: 'Facebook page provides social proof and additional contact channel'
    });
  }

  // Use AI to prioritize and enhance the enrichment plan
  if (missingFields.length > 0) {
    try {
      const prompt = `You are analyzing a business listing for ${business.name} in ${business.city}, ${business.state}.

Current data: ${JSON.stringify({
        name: business.name,
        category: business.category_id,
        description: business.description,
        phone: business.phone,
        email: business.email,
        website: business.website
      }, null, 2)}

Missing fields: ${missingFields.map(f => f.field).join(', ')}

Prioritize these fields by importance for this specific business type and provide enhanced reasoning.
Return ONLY a JSON array of objects with "field" and "reasoning" properties, ordered by priority.`;

      const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: 'You are a business listing optimization expert. Respond only with valid JSON.' },
          { role: 'user', content: prompt }
        ]
      });

      // Parse AI response
      if (aiResponse && typeof aiResponse === 'object' && 'response' in aiResponse) {
        const responseText = (aiResponse as any).response;
        const parsed = JSON.parse(responseText);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 5); // Limit to top 5 priorities
        }
      }
    } catch (error) {
      console.warn('AI enrichment planning failed, using default plan:', error);
    }
  }

  // Return default plan if AI fails
  return missingFields.slice(0, 5);
}
