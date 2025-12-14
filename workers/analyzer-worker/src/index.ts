/**
 * Kiamichi Biz AI Analyzer Worker
 *
 * Analyzes and enriches business listings using AI and web intelligence
 * - Manual mode: Admin-triggered analysis with suggestions for review
 * - Auto mode: Conservative autonomous updates (2-3 per day via cron)
 */

/// <reference types="@cloudflare/workers-types" />

import { Env, Business, AnalysisResult, EnrichmentSuggestion, AnalyzeRequest, AnalyzeResponse } from './types';
import { analyzeCompleteness, generateEnrichmentPlan } from './analyzer';
import { browseWeb, extractDataFromWeb } from './webTools';
import { applyAutoUpdates, storeSuggestions, getBusinessById } from './database';

export default {
  /**
   * HTTP endpoint for manual analysis
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': env.MAIN_WORKER_URL,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Analyze business endpoint
      if (path === '/analyze' && request.method === 'POST') {
        const body: AnalyzeRequest = await request.json();
        const result = await analyzeBusiness(body, env);

        return Response.json(result, { headers: corsHeaders });
      }

      // Health check
      if (path === '/health') {
        return Response.json({
          status: 'healthy',
          version: env.ANALYZER_VERSION,
          timestamp: Date.now()
        }, { headers: corsHeaders });
      }

      // Get analysis result
      if (path.startsWith('/analysis/') && request.method === 'GET') {
        const businessId = parseInt(path.split('/')[2]);
        const analysis = await getLatestAnalysis(businessId, env);

        return Response.json(analysis || { error: 'Not found' }, {
          status: analysis ? 200 : 404,
          headers: corsHeaders
        });
      }

      return Response.json({ error: 'Not found' }, { status: 404, headers: corsHeaders });

    } catch (error) {
      console.error('Error:', error);
      return Response.json({
        error: error instanceof Error ? error.message : 'Internal server error'
      }, { status: 500, headers: corsHeaders });
    }
  },

  /**
   * Cron trigger for autonomous updates
   * Runs 3x per day: 8am, 2pm, 8pm Central
   */
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    console.log('Starting autonomous business analysis cron...');

    try {
      // Get businesses that need autonomous updates
      const businesses = await getBusinessesForAutoUpdate(env);

      console.log(`Found ${businesses.length} businesses for autonomous update`);

      let updatedCount = 0;
      const maxPerRun = 10; // Limit to 10 businesses per cron run

      for (const business of businesses.slice(0, maxPerRun)) {
        try {
          const result = await analyzeBusiness({
            businessId: business.id,
            mode: 'auto'
          }, env);

          if (result.success && result.autoAppliedCount && result.autoAppliedCount > 0) {
            updatedCount++;
            console.log(`✓ Auto-updated business ${business.id} (${business.name}): ${result.autoAppliedCount} changes`);
          }

        } catch (error) {
          console.error(`Failed to analyze business ${business.id}:`, error);
        }

        // Rate limiting: 2 second delay between businesses
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      console.log(`Autonomous cron completed: ${updatedCount} businesses updated`);

    } catch (error) {
      console.error('Cron error:', error);
    }
  }
};

/**
 * Main business analysis function
 */
async function analyzeBusiness(request: AnalyzeRequest, env: Env): Promise<AnalyzeResponse> {
  const { businessId, mode, adminEmail } = request;

  console.log(`Analyzing business ${businessId} in ${mode} mode`);

  // Fetch business data
  const business = await getBusinessById(businessId, env);
  if (!business) {
    return {
      success: false,
      businessId,
      mode,
      error: 'Business not found'
    };
  }

  // Step 1: Analyze completeness
  const completenessScore = analyzeCompleteness(business);
  console.log(`Completeness score: ${completenessScore}/100`);

  // Step 2: Generate enrichment plan using AI
  const enrichmentPlan = await generateEnrichmentPlan(business, env);
  console.log(`Generated ${enrichmentPlan.length} enrichment suggestions`);

  // Step 3: Execute enrichment plan (web search, data extraction)
  const suggestions: EnrichmentSuggestion[] = [];

  for (const item of enrichmentPlan) {
    try {
      const webData = await browseWeb(business, item.field, env);
      const extracted = extractDataFromWeb(webData, item.field);

      if (extracted.value && extracted.confidence > 0.7) {
        suggestions.push({
          field: item.field,
          currentValue: (business as any)[item.field] || null,
          suggestedValue: extracted.value,
          confidence: extracted.confidence,
          source: extracted.source,
          sourceType: extracted.sourceType,
          reasoning: item.reasoning
        });
      }
    } catch (error) {
      console.warn(`Failed to enrich field ${item.field}:`, error);
    }
  }

  console.log(`Found ${suggestions.length} validated suggestions`);

  // Step 4: Store analysis results
  await storeAnalysisResult(businessId, completenessScore, suggestions, env);

  // Step 5: Handle based on mode
  if (mode === 'auto') {
    // Auto mode: Apply high-confidence suggestions automatically
    const threshold = parseFloat(env.AUTO_APPLY_CONFIDENCE_THRESHOLD);
    const highConfidenceSuggestions = suggestions.filter(s => s.confidence >= threshold);

    const autoAppliedCount = await applyAutoUpdates(businessId, highConfidenceSuggestions, env);

    return {
      success: true,
      businessId,
      mode,
      completenessScore,
      suggestionsCount: suggestions.length,
      autoAppliedCount
    };

  } else {
    // Manual mode: Store suggestions for admin review
    await storeSuggestions(businessId, suggestions, env);

    return {
      success: true,
      businessId,
      mode,
      completenessScore,
      suggestionsCount: suggestions.length,
      autoAppliedCount: 0
    };
  }
}

/**
 * Get businesses that need autonomous updates
 */
async function getBusinessesForAutoUpdate(env: Env): Promise<Business[]> {
  const { results } = await env.DB.prepare(`
    SELECT b.* FROM businesses b
    LEFT JOIN business_analysis ba ON b.id = ba.business_id
    WHERE b.is_active = 1
    AND (
      ba.id IS NULL
      OR ba.completeness_score < 80
      OR (julianday('now') - julianday(ba.analysis_date, 'unixepoch')) > 7
    )
    ORDER BY
      CASE WHEN ba.id IS NULL THEN 0 ELSE 1 END,
      ba.completeness_score ASC,
      b.created_at DESC
    LIMIT 20
  `).all();

  return results as Business[];
}

/**
 * Get latest analysis for a business
 */
async function getLatestAnalysis(businessId: number, env: Env): Promise<any> {
  const result = await env.DB.prepare(`
    SELECT * FROM business_analysis
    WHERE business_id = ?
    ORDER BY analysis_date DESC
    LIMIT 1
  `).bind(businessId).first();

  if (!result) return null;

  return {
    ...result,
    missing_fields: JSON.parse(result.missing_fields as string || '[]'),
    suggestions: JSON.parse(result.suggestions as string || '[]'),
    found_data: JSON.parse(result.found_data as string || '{}'),
    confidence_scores: JSON.parse(result.confidence_scores as string || '{}')
  };
}

/**
 * Store analysis result in database
 */
async function storeAnalysisResult(
  businessId: number,
  completenessScore: number,
  suggestions: EnrichmentSuggestion[],
  env: Env
): Promise<void> {
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
    JSON.stringify(suggestions.map(s => s.reasoning)),
    JSON.stringify(foundData),
    JSON.stringify(confidenceScores),
    env.ANALYZER_VERSION
  ).run();
}
