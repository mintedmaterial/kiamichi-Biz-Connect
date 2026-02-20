/**
 * Template-Based Code Mode Implementation
 * 
 * LLM selects from predefined operation templates instead of writing arbitrary code.
 * Works without Worker Loader beta access.
 * 
 * TODO: Upgrade to full Code Mode when worker_loaders access is granted.
 */

import { Env, Business, EnrichmentSuggestion } from './types';
import { analyzeCompleteness, generateEnrichmentPlan } from './analyzer';
import { browseWeb, extractDataFromWeb } from './webTools';
import { applyAutoUpdates, getBusinessById } from './database';

/**
 * Tool functions bound to environment
 */
function createTools(env: Env) {
  return {
    async getBusinessesForUpdate({ limit = 10 }: { limit?: number }) {
      const { results } = await env.DB.prepare(`
        SELECT b.id, b.name, b.city, b.state FROM businesses b
        LEFT JOIN business_analysis ba ON b.id = ba.business_id
        WHERE b.is_active = 1
        AND (ba.id IS NULL OR ba.completeness_score < 80
          OR (julianday('now') - julianday(ba.analysis_date, 'unixepoch')) > 7)
        ORDER BY CASE WHEN ba.id IS NULL THEN 0 ELSE 1 END, ba.completeness_score ASC
        LIMIT ?
      `).bind(limit).all();
      return results as Business[];
    },

    async analyzeCompleteness({ businessId }: { businessId: number }) {
      const business = await getBusinessById(businessId, env);
      if (!business) return { score: 0, needsEnrichment: true, error: 'Not found' };
      const score = analyzeCompleteness(business);
      return { score, needsEnrichment: score < 80, name: business.name };
    },

    async generateEnrichmentPlan({ businessId }: { businessId: number }) {
      const business = await getBusinessById(businessId, env);
      if (!business) return { fields: [], error: 'Not found' };
      const plan = await generateEnrichmentPlan(business, env);
      return { fields: plan.map(p => p.field) };
    },

    async enrichFromWeb({ businessId, fields }: { businessId: number; fields: string[] }) {
      const business = await getBusinessById(businessId, env);
      if (!business) return { suggestions: [], error: 'Not found' };
      
      const suggestions: EnrichmentSuggestion[] = [];
      for (const field of fields.slice(0, 3)) { // Limit to 3 fields per business
        try {
          const webData = await browseWeb(business, field, env);
          const extracted = extractDataFromWeb(webData, field);
          if (extracted.value && extracted.confidence > 0.5) {
            suggestions.push({
              field,
              currentValue: (business as any)[field] || null,
              suggestedValue: extracted.value,
              confidence: extracted.confidence,
              source: extracted.source,
              sourceType: extracted.sourceType,
              reasoning: `Found via web search`
            });
          }
        } catch (e) {
          console.warn(`[CodeMode] Failed to enrich ${field}:`, e);
        }
      }
      return { suggestions, count: suggestions.length };
    },

    async applyUpdates({ businessId, suggestions, threshold = 0.95 }: { 
      businessId: number; 
      suggestions: EnrichmentSuggestion[]; 
      threshold?: number 
    }) {
      const highConf = suggestions.filter(s => s.confidence >= threshold);
      if (highConf.length === 0) return { applied: 0 };
      const applied = await applyAutoUpdates(businessId, highConf, env);
      return { applied, fields: highConf.map(s => s.field) };
    }
  };
}

type Tools = ReturnType<typeof createTools>;

/**
 * Predefined operation templates
 */
const OPERATION_TEMPLATES = {
  /**
   * Full analysis: score → plan → enrich → apply
   */
  'full-analysis': async (tools: Tools, params: { limit?: number }) => {
    const businesses = await tools.getBusinessesForUpdate({ limit: params.limit || 5 });
    console.log(`[CodeMode] Processing ${businesses.length} businesses`);
    
    let processed = 0;
    let updated = 0;
    
    for (const biz of businesses) {
      try {
        const score = await tools.analyzeCompleteness({ businessId: biz.id });
        console.log(`[CodeMode] ${biz.name}: score=${score.score}`);
        processed++;
        
        if (score.needsEnrichment) {
          const plan = await tools.generateEnrichmentPlan({ businessId: biz.id });
          if (plan.fields.length > 0) {
            const data = await tools.enrichFromWeb({ businessId: biz.id, fields: plan.fields });
            if (data.suggestions.length > 0) {
              const result = await tools.applyUpdates({ 
                businessId: biz.id, 
                suggestions: data.suggestions 
              });
              if (result.applied > 0) {
                updated++;
                console.log(`[CodeMode] ${biz.name}: applied ${result.applied} updates`);
              }
            }
          }
        }
      } catch (e) {
        console.error(`[CodeMode] Error processing ${biz.name}:`, e);
      }
    }
    
    return { processed, updated };
  },

  /**
   * Score only: just calculate completeness scores
   */
  'score-only': async (tools: Tools, params: { limit?: number }) => {
    const businesses = await tools.getBusinessesForUpdate({ limit: params.limit || 10 });
    const scores: { id: number; name: string; score: number }[] = [];
    
    for (const biz of businesses) {
      const result = await tools.analyzeCompleteness({ businessId: biz.id });
      scores.push({ id: biz.id, name: biz.name, score: result.score });
    }
    
    return { processed: scores.length, updated: 0, scores };
  },

  /**
   * Enrich only: skip scoring, go straight to web enrichment
   */
  'enrich-only': async (tools: Tools, params: { limit?: number; fields?: string[] }) => {
    const businesses = await tools.getBusinessesForUpdate({ limit: params.limit || 3 });
    const defaultFields = params.fields || ['phone', 'website', 'email'];
    let updated = 0;
    
    for (const biz of businesses) {
      const data = await tools.enrichFromWeb({ businessId: biz.id, fields: defaultFields });
      if (data.suggestions.length > 0) {
        const result = await tools.applyUpdates({ businessId: biz.id, suggestions: data.suggestions });
        if (result.applied > 0) updated++;
      }
    }
    
    return { processed: businesses.length, updated };
  }
};

type TemplateName = keyof typeof OPERATION_TEMPLATES;

/**
 * Run template-based Code Mode cron
 */
export async function runCodeModeCron(env: Env): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  template?: string;
  error?: string;
}> {
  console.log('[CodeMode] Starting template-based cron...');

  try {
    const tools = createTools(env);

    // Ask LLM to select the best operation template
    const prompt = `You are a business data analyzer scheduler. Based on the current time and workload, select ONE operation:

1. "full-analysis" - Complete analysis: score businesses, plan enrichment, search web, apply updates. Use for normal cron runs.
2. "score-only" - Just calculate completeness scores. Use for quick health checks.
3. "enrich-only" - Skip scoring, directly enrich from web. Use when you know data is stale.

Current time: ${new Date().toISOString()}
This is a scheduled cron run (3x daily).

Respond with ONLY the template name, nothing else. Example: full-analysis`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You select operations. Output ONLY the operation name.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 20
    });

    let templateName = ((aiResponse as any).response || 'full-analysis').trim().toLowerCase();
    
    // Validate template name
    if (!OPERATION_TEMPLATES[templateName as TemplateName]) {
      console.log(`[CodeMode] Invalid template "${templateName}", defaulting to full-analysis`);
      templateName = 'full-analysis';
    }

    console.log(`[CodeMode] Selected template: ${templateName}`);

    // Execute the selected template
    const result = await OPERATION_TEMPLATES[templateName as TemplateName](tools, { limit: 5 });

    console.log(`[CodeMode] Complete: ${result.processed} processed, ${result.updated} updated`);

    return {
      success: true,
      processed: result.processed,
      updated: result.updated,
      template: templateName
    };

  } catch (error) {
    console.error('[CodeMode] Error:', error);
    return {
      success: false,
      processed: 0,
      updated: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
