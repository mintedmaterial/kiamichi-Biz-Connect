/**
 * Database operations for analyzer worker
 */

import { Business, Env, EnrichmentSuggestion } from './types';

/**
 * Get business by ID
 */
export async function getBusinessById(businessId: number, env: Env): Promise<Business | null> {
  const result = await env.DB.prepare(`
    SELECT * FROM businesses
    WHERE id = ?
  `).bind(businessId).first();

  return result as Business | null;
}

/**
 * Apply high-confidence auto updates
 */
export async function applyAutoUpdates(
  businessId: number,
  suggestions: EnrichmentSuggestion[],
  env: Env
): Promise<number> {
  if (suggestions.length === 0) {
    return 0;
  }

  // Check daily update limit
  const maxUpdates = parseInt(env.MAX_AUTO_UPDATES_PER_DAY);
  const todayUpdates = await getTodayAutoUpdateCount(businessId, env);

  if (todayUpdates >= maxUpdates) {
    console.log(`Business ${businessId} has reached daily auto-update limit (${maxUpdates})`);
    return 0;
  }

  const remainingUpdates = maxUpdates - todayUpdates;
  const suggestionsToApply = suggestions.slice(0, remainingUpdates);

  let appliedCount = 0;

  // Begin transaction
  for (const suggestion of suggestionsToApply) {
    try {
      // Update the business record
      await env.DB.prepare(`
        UPDATE businesses
        SET ${suggestion.field} = ?,
            updated_at = unixepoch()
        WHERE id = ?
      `).bind(suggestion.suggestedValue, businessId).run();

      // Record the auto-applied suggestion
      await env.DB.prepare(`
        INSERT INTO enrichment_suggestions (
          business_id, field_name, current_value, suggested_value,
          confidence, source_url, source_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'auto_applied')
      `).bind(
        businessId,
        suggestion.field,
        suggestion.currentValue,
        suggestion.suggestedValue,
        suggestion.confidence,
        suggestion.source,
        suggestion.sourceType
      ).run();

      appliedCount++;
      console.log(`✓ Auto-applied ${suggestion.field} for business ${businessId} (confidence: ${suggestion.confidence})`);

    } catch (error) {
      console.error(`Failed to apply suggestion for field ${suggestion.field}:`, error);
    }
  }

  return appliedCount;
}

/**
 * Store suggestions for manual review
 */
export async function storeSuggestions(
  businessId: number,
  suggestions: EnrichmentSuggestion[],
  env: Env
): Promise<void> {
  for (const suggestion of suggestions) {
    try {
      await env.DB.prepare(`
        INSERT INTO enrichment_suggestions (
          business_id, field_name, current_value, suggested_value,
          confidence, source_url, source_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(
        businessId,
        suggestion.field,
        suggestion.currentValue,
        suggestion.suggestedValue,
        suggestion.confidence,
        suggestion.source,
        suggestion.sourceType
      ).run();

    } catch (error) {
      console.error(`Failed to store suggestion for field ${suggestion.field}:`, error);
    }
  }
}

/**
 * Get count of auto-applied updates today for a business
 */
async function getTodayAutoUpdateCount(businessId: number, env: Env): Promise<number> {
  const startOfDay = Math.floor(Date.now() / 1000) - (Math.floor(Date.now() / 1000) % 86400);

  const result = await env.DB.prepare(`
    SELECT COUNT(*) as count
    FROM enrichment_suggestions
    WHERE business_id = ?
      AND status = 'auto_applied'
      AND created_at >= ?
  `).bind(businessId, startOfDay).first();

  return (result?.count as number) || 0;
}
