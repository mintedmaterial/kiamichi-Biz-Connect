/**
 * Minimal Code Mode Implementation
 * 
 * No external dependencies - uses Workers AI directly and SimpleExecutor.
 * The LLM writes code against our tool API, we execute it.
 */

import { Env, Business, EnrichmentSuggestion } from './types';
import { analyzeCompleteness, generateEnrichmentPlan } from './analyzer';
import { browseWeb, extractDataFromWeb } from './webTools';
import { applyAutoUpdates, getBusinessById } from './database';
import { SimpleExecutor } from './simple-executor';

/**
 * TypeScript API definition for the LLM
 */
const CODEMODE_API_TYPES = `
interface CodeModeAPI {
  // Get businesses needing analysis
  getBusinessesForUpdate(opts: { limit?: number }): Promise<Business[]>;
  
  // Analyze completeness (0-100)
  analyzeCompleteness(opts: { businessId: number }): Promise<{ score: number; needsEnrichment: boolean }>;
  
  // Get enrichment plan
  generateEnrichmentPlan(opts: { businessId: number }): Promise<{ fields: string[] }>;
  
  // Search web for data
  enrichFromWeb(opts: { businessId: number; fields: string[] }): Promise<{ suggestions: Suggestion[] }>;
  
  // Apply high-confidence updates
  applyUpdates(opts: { businessId: number; suggestions: Suggestion[]; threshold?: number }): Promise<{ applied: number }>;
}

interface Business { id: number; name: string; city: string; state: string; }
interface Suggestion { field: string; suggestedValue: any; confidence: number; }
`;

/**
 * Create the codemode tool functions bound to env
 */
function createCodeModeTools(env: Env) {
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
      return { score, needsEnrichment: score < 80 };
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
      for (const field of fields) {
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
          console.warn(`Failed to enrich ${field}:`, e);
        }
      }
      return { suggestions };
    },

    async applyUpdates({ businessId, suggestions, threshold = 0.95 }: { 
      businessId: number; 
      suggestions: EnrichmentSuggestion[]; 
      threshold?: number 
    }) {
      const highConf = suggestions.filter(s => s.confidence >= threshold);
      if (highConf.length === 0) return { applied: 0 };
      const applied = await applyAutoUpdates(businessId, highConf, env);
      return { applied };
    }
  };
}

/**
 * Run Code Mode analysis cron
 */
export async function runCodeModeCron(env: Env): Promise<{
  success: boolean;
  processed: number;
  updated: number;
  error?: string;
}> {
  console.log('[CodeMode] Starting minimal code mode cron...');

  try {
    const tools = createCodeModeTools(env);
    const executor = new SimpleExecutor({ timeout: 60000 });

    // Generate analysis code using Workers AI
    const prompt = `You are a business data analyzer. Write JavaScript code to analyze businesses.

Available API (already bound to 'codemode' object):
${CODEMODE_API_TYPES}

Write an async arrow function that:
1. Gets up to 5 businesses needing analysis
2. For each, check completeness score
3. If score < 80, get enrichment plan and search web
4. Apply updates with confidence >= 0.95
5. Return { processed: number, updated: number }

ONLY output the arrow function code, nothing else. Example format:
async () => {
  const businesses = await codemode.getBusinessesForUpdate({ limit: 5 });
  // ... your code
  return { processed: businesses.length, updated: 0 };
}`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: 'You write clean JavaScript code. Output ONLY the code, no explanations.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 1024
    });

    const generatedCode = (aiResponse as any).response || '';
    console.log('[CodeMode] Generated code:', generatedCode.slice(0, 200) + '...');

    // Extract just the function body if wrapped
    let code = generatedCode.trim();
    if (code.startsWith('```')) {
      code = code.replace(/```[a-z]*\n?/g, '').trim();
    }

    // Execute the generated code
    const result = await executor.execute(code, tools);

    if (result.error) {
      console.error('[CodeMode] Execution error:', result.error);
      return { success: false, processed: 0, updated: 0, error: result.error };
    }

    const summary = result.result as { processed?: number; updated?: number } || {};
    console.log(`[CodeMode] Complete: ${summary.processed || 0} processed, ${summary.updated || 0} updated`);
    
    if (result.logs?.length) {
      console.log('[CodeMode] Logs:', result.logs.join('\n'));
    }

    return {
      success: true,
      processed: summary.processed || 0,
      updated: summary.updated || 0
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
