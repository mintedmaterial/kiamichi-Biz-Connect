/**
 * Code Mode Tools for KBC Analyzer
 * 
 * Exposes analyzer functions as typed tools for LLM code generation.
 * The LLM writes code against this API instead of making individual tool calls.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { Env, Business, EnrichmentSuggestion } from './types';
import { analyzeCompleteness, generateEnrichmentPlan } from './analyzer';
import { browseWeb, extractDataFromWeb } from './webTools';
import { applyAutoUpdates, getBusinessById } from './database';

/**
 * Create Code Mode tools with bound environment
 */
export function createAnalyzerTools(env: Env) {
  return {
    /**
     * Get businesses that need analysis/enrichment
     */
    getBusinessesForUpdate: tool({
      description: 'Get businesses that need analysis or enrichment based on completeness score and last analysis date',
      parameters: z.object({
        limit: z.number().optional().default(10).describe('Maximum number of businesses to return'),
        minCompleteness: z.number().optional().describe('Only return businesses below this completeness score'),
        daysStale: z.number().optional().default(7).describe('Include businesses not analyzed in this many days')
      }),
      execute: async ({ limit, minCompleteness, daysStale }) => {
        const { results } = await env.DB.prepare(`
          SELECT b.* FROM businesses b
          LEFT JOIN business_analysis ba ON b.id = ba.business_id
          WHERE b.is_active = 1
          AND (
            ba.id IS NULL
            ${minCompleteness ? `OR ba.completeness_score < ${minCompleteness}` : 'OR ba.completeness_score < 80'}
            OR (julianday('now') - julianday(ba.analysis_date, 'unixepoch')) > ${daysStale}
          )
          ORDER BY
            CASE WHEN ba.id IS NULL THEN 0 ELSE 1 END,
            ba.completeness_score ASC
          LIMIT ${limit}
        `).all();
        
        return results as Business[];
      }
    }),

    /**
     * Analyze a single business's completeness
     */
    analyzeCompleteness: tool({
      description: 'Calculate completeness score (0-100) for a business based on filled fields',
      parameters: z.object({
        businessId: z.number().describe('The business ID to analyze')
      }),
      execute: async ({ businessId }) => {
        const business = await getBusinessById(businessId, env);
        if (!business) {
          return { error: 'Business not found', businessId };
        }
        
        const score = analyzeCompleteness(business);
        return { 
          businessId, 
          name: business.name,
          score,
          needsEnrichment: score < 80
        };
      }
    }),

    /**
     * Generate an enrichment plan for missing data
     */
    generateEnrichmentPlan: tool({
      description: 'Generate a plan of which fields need enrichment and why',
      parameters: z.object({
        businessId: z.number().describe('The business ID to plan enrichment for')
      }),
      execute: async ({ businessId }) => {
        const business = await getBusinessById(businessId, env);
        if (!business) {
          return { error: 'Business not found', businessId };
        }
        
        const plan = await generateEnrichmentPlan(business, env);
        return {
          businessId,
          name: business.name,
          fieldsToEnrich: plan.map(p => p.field),
          plan
        };
      }
    }),

    /**
     * Search the web for business data
     */
    enrichFromWeb: tool({
      description: 'Search the web to find data for specific fields of a business',
      parameters: z.object({
        businessId: z.number().describe('The business ID to enrich'),
        fields: z.array(z.string()).describe('Fields to search for: phone, email, website, hours, facebook_url, description')
      }),
      execute: async ({ businessId, fields }) => {
        const business = await getBusinessById(businessId, env);
        if (!business) {
          return { error: 'Business not found', businessId };
        }
        
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
                reasoning: `Found ${field} via web search`
              });
            }
          } catch (error) {
            console.warn(`Failed to enrich field ${field}:`, error);
          }
        }
        
        return {
          businessId,
          name: business.name,
          suggestions,
          foundCount: suggestions.length
        };
      }
    }),

    /**
     * Apply enrichment updates to a business
     */
    applyUpdates: tool({
      description: 'Apply high-confidence enrichment suggestions to a business. Only applies if confidence >= threshold.',
      parameters: z.object({
        businessId: z.number().describe('The business ID to update'),
        suggestions: z.array(z.object({
          field: z.string(),
          suggestedValue: z.any(),
          confidence: z.number()
        })).describe('Enrichment suggestions to apply'),
        confidenceThreshold: z.number().optional().default(0.95).describe('Minimum confidence to apply (default 0.95)')
      }),
      execute: async ({ businessId, suggestions, confidenceThreshold }) => {
        const highConfidence = suggestions.filter(s => s.confidence >= confidenceThreshold);
        
        if (highConfidence.length === 0) {
          return {
            businessId,
            applied: 0,
            reason: `No suggestions met confidence threshold of ${confidenceThreshold}`
          };
        }
        
        const applied = await applyAutoUpdates(businessId, highConfidence as EnrichmentSuggestion[], env);
        
        return {
          businessId,
          applied,
          fields: highConfidence.map(s => s.field)
        };
      }
    }),

    /**
     * Store analysis results for later review
     */
    storeAnalysis: tool({
      description: 'Store analysis results in the database for admin review',
      parameters: z.object({
        businessId: z.number(),
        completenessScore: z.number(),
        suggestions: z.array(z.object({
          field: z.string(),
          suggestedValue: z.any(),
          confidence: z.number(),
          reasoning: z.string().optional()
        }))
      }),
      execute: async ({ businessId, completenessScore, suggestions }) => {
        const missingFields = suggestions.map(s => s.field);
        const foundData = suggestions.reduce((acc, s) => {
          acc[s.field] = s.suggestedValue;
          return acc;
        }, {} as Record<string, any>);
        const confidenceScores = suggestions.reduce((acc, s) => {
          acc[s.field] = s.confidence;
          return acc;
        }, {} as Record<string, number>);

        await env.DB.prepare(`
          INSERT INTO business_analysis (
            business_id, completeness_score, missing_fields, suggestions,
            found_data, confidence_scores, analyzer_version
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          businessId,
          completenessScore,
          JSON.stringify(missingFields),
          JSON.stringify(suggestions.map(s => s.reasoning || '')),
          JSON.stringify(foundData),
          JSON.stringify(confidenceScores),
          env.ANALYZER_VERSION
        ).run();
        
        return { stored: true, businessId, fieldsAnalyzed: missingFields.length };
      }
    })
  };
}

export type AnalyzerTools = ReturnType<typeof createAnalyzerTools>;
