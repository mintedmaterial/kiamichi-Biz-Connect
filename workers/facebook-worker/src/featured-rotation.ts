/**
 * Featured Business Rotation System
 * Automatically rotates which businesses appear in the "Featured" section
 * 
 * Schedule: Runs daily at midnight UTC (6 PM CST)
 * Logic: Rotate slots that haven't been updated in 7+ days
 */

export interface RotationConfig {
  slotsCount: number;           // Number of featured slots (default: 6)
  rotationDays: number;         // Days before rotation (default: 7)
  prioritizeVerified: boolean;  // Prioritize verified businesses
  excludeRecentDays: number;    // Don't re-feature within X days (default: 30)
}

export interface RotationResult {
  rotated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    slot: number;
    oldBusiness: string | null;
    newBusiness: string;
  }>;
}

const DEFAULT_CONFIG: RotationConfig = {
  slotsCount: 6,
  rotationDays: 7,
  prioritizeVerified: true,
  excludeRecentDays: 30
};

/**
 * Main rotation function - call from cron handler
 */
export async function rotateFeaturedBusinesses(
  env: any, 
  config: Partial<RotationConfig> = {}
): Promise<RotationResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);
  const rotationThreshold = now - (cfg.rotationDays * 86400);
  
  const result: RotationResult = {
    rotated: 0,
    skipped: 0,
    errors: [],
    details: []
  };

  try {
    // Get slots that need rotation (priority_source = 'rotation' and stale)
    const slotsNeedingRotation = await db.prepare(`
      SELECT fs.*, b.name as current_business_name 
      FROM featured_slots fs
      LEFT JOIN businesses b ON fs.business_id = b.id
      WHERE fs.priority_source = 'rotation'
      AND (fs.last_rotated IS NULL OR fs.last_rotated < ?)
      ORDER BY fs.slot_position
    `).bind(rotationThreshold).all();

    if (!slotsNeedingRotation.results?.length) {
      console.log('[Rotation] No slots need rotation');
      return result;
    }

    console.log(`[Rotation] ${slotsNeedingRotation.results.length} slots need rotation`);

    // Get eligible businesses from featured_tier_members pool only
    // This limits rotation to businesses in the paid/featured tier (IDs 1-20 for now)
    const excludeThreshold = now - (cfg.excludeRecentDays * 86400);
    
    const eligibleBusinesses = await db.prepare(`
      SELECT b.* FROM businesses b
      INNER JOIN featured_tier_members ftm ON b.id = ftm.business_id
      WHERE b.is_active = 1
      AND b.is_featured = 0
      AND (ftm.tier_end IS NULL OR ftm.tier_end > ?)
      AND b.id NOT IN (
        SELECT DISTINCT business_id FROM featured_rotation_log 
        WHERE featured_end > ? OR featured_end IS NULL
      )
      ORDER BY 
        CASE WHEN ftm.tier_level = 'premium' THEN 0 
             WHEN ftm.tier_level = 'basic' THEN 1 
             ELSE 2 END,
        CASE WHEN b.facebook_url IS NOT NULL THEN 0 ELSE 1 END,
        CASE WHEN b.is_verified = 1 THEN 0 ELSE 1 END,
        b.google_rating DESC,
        RANDOM()
      LIMIT ?
    `).bind(now, excludeThreshold, slotsNeedingRotation.results.length + 5).all();

    if (!eligibleBusinesses.results?.length) {
      console.log('[Rotation] No eligible businesses for rotation');
      result.errors.push('No eligible businesses found for rotation');
      return result;
    }

    console.log(`[Rotation] Found ${eligibleBusinesses.results.length} eligible businesses`);

    // Rotate each slot
    let eligibleIndex = 0;
    for (const slot of slotsNeedingRotation.results as any[]) {
      if (eligibleIndex >= eligibleBusinesses.results.length) {
        result.skipped++;
        result.errors.push(`Slot ${slot.slot_position}: No more eligible businesses`);
        continue;
      }

      const newBusiness = eligibleBusinesses.results[eligibleIndex] as any;
      eligibleIndex++;

      try {
        // 1. End previous featured period (if any)
        if (slot.business_id) {
          await db.prepare(`
            UPDATE featured_rotation_log 
            SET featured_end = ? 
            WHERE business_id = ? AND featured_end IS NULL
          `).bind(now, slot.business_id).run();

          // Remove is_featured flag from old business
          await db.prepare(`
            UPDATE businesses SET is_featured = 0 WHERE id = ?
          `).bind(slot.business_id).run();
        }

        // 2. Start new featured period
        await db.prepare(`
          INSERT INTO featured_rotation_log 
          (business_id, featured_start, rotation_reason, slot_position)
          VALUES (?, ?, 'scheduled', ?)
        `).bind(newBusiness.id, now, slot.slot_position).run();

        // 3. Update slot with new business
        await db.prepare(`
          UPDATE featured_slots 
          SET business_id = ?, last_rotated = ?, priority_source = 'rotation'
          WHERE id = ?
        `).bind(newBusiness.id, now, slot.id).run();

        // 4. Set is_featured flag on new business
        await db.prepare(`
          UPDATE businesses SET is_featured = 1 WHERE id = ?
        `).bind(newBusiness.id).run();

        result.rotated++;
        result.details.push({
          slot: slot.slot_position,
          oldBusiness: slot.current_business_name || null,
          newBusiness: newBusiness.name
        });

        console.log(`[Rotation] Slot ${slot.slot_position}: ${slot.current_business_name || 'empty'} → ${newBusiness.name}`);
      } catch (err: any) {
        result.errors.push(`Slot ${slot.slot_position}: ${err.message}`);
        console.error(`[Rotation] Error rotating slot ${slot.slot_position}:`, err);
      }
    }

    return result;
  } catch (err: any) {
    result.errors.push(`Rotation failed: ${err.message}`);
    console.error('[Rotation] Fatal error:', err);
    return result;
  }
}

/**
 * Get current featured businesses with slot info
 */
export async function getFeaturedStatus(env: any): Promise<any[]> {
  const db = env.DB;
  
  const result = await db.prepare(`
    SELECT 
      fs.slot_position,
      fs.priority_source,
      fs.last_rotated,
      fs.rotation_interval_days,
      b.id as business_id,
      b.name as business_name,
      b.slug,
      b.city,
      b.google_rating,
      b.is_verified,
      frl.featured_start
    FROM featured_slots fs
    LEFT JOIN businesses b ON fs.business_id = b.id
    LEFT JOIN featured_rotation_log frl ON b.id = frl.business_id AND frl.featured_end IS NULL
    ORDER BY fs.slot_position
  `).all();
  
  return result.results || [];
}

/**
 * Manually set a business as featured in a specific slot
 */
export async function manuallyFeatureBusiness(
  env: any, 
  businessId: number, 
  slotPosition: number
): Promise<{ success: boolean; error?: string }> {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    // Get current slot occupant
    const slot = await db.prepare(`
      SELECT * FROM featured_slots WHERE slot_position = ?
    `).bind(slotPosition).first();

    if (!slot) {
      return { success: false, error: `Slot ${slotPosition} does not exist` };
    }

    // End previous featured period
    if (slot.business_id) {
      await db.prepare(`
        UPDATE featured_rotation_log SET featured_end = ?
        WHERE business_id = ? AND featured_end IS NULL
      `).bind(now, slot.business_id).run();

      await db.prepare(`
        UPDATE businesses SET is_featured = 0 WHERE id = ?
      `).bind(slot.business_id).run();
    }

    // Feature new business
    await db.prepare(`
      INSERT INTO featured_rotation_log 
      (business_id, featured_start, rotation_reason, slot_position)
      VALUES (?, ?, 'manual', ?)
    `).bind(businessId, now, slotPosition).run();

    await db.prepare(`
      UPDATE featured_slots 
      SET business_id = ?, last_rotated = ?, priority_source = 'manual'
      WHERE slot_position = ?
    `).bind(businessId, now, slotPosition).run();

    await db.prepare(`
      UPDATE businesses SET is_featured = 1 WHERE id = ?
    `).bind(businessId).run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Lock a slot from automatic rotation (e.g., for paid placements)
 */
export async function lockSlot(
  env: any, 
  slotPosition: number, 
  businessId: number,
  reason: 'ad' | 'manual' = 'manual'
): Promise<{ success: boolean; error?: string }> {
  const db = env.DB;
  const now = Math.floor(Date.now() / 1000);

  try {
    await db.prepare(`
      UPDATE featured_slots 
      SET business_id = ?, priority_source = ?, last_rotated = ?
      WHERE slot_position = ?
    `).bind(businessId, reason, now, slotPosition).run();

    await db.prepare(`
      UPDATE businesses SET is_featured = 1 WHERE id = ?
    `).bind(businessId).run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Unlock a slot for automatic rotation
 */
export async function unlockSlot(
  env: any, 
  slotPosition: number
): Promise<{ success: boolean; error?: string }> {
  const db = env.DB;

  try {
    await db.prepare(`
      UPDATE featured_slots 
      SET priority_source = 'rotation'
      WHERE slot_position = ?
    `).bind(slotPosition).run();

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Get all businesses in the featured tier pool with their Facebook status
 */
export async function getFeaturedTierMembers(env: any): Promise<any[]> {
  const db = env.DB;
  
  const result = await db.prepare(`
    SELECT 
      b.id,
      b.name,
      b.slug,
      b.city,
      b.description,
      b.facebook_url,
      b.facebook_page_id,
      b.google_rating,
      b.is_verified,
      b.is_featured,
      b.is_active,
      ftm.tier_level,
      ftm.tier_start,
      ftm.tier_end,
      CASE WHEN b.facebook_url IS NOT NULL THEN 1 ELSE 0 END as has_facebook
    FROM featured_tier_members ftm
    INNER JOIN businesses b ON ftm.business_id = b.id
    WHERE ftm.tier_end IS NULL OR ftm.tier_end > ?
    ORDER BY b.id
  `).bind(Math.floor(Date.now() / 1000)).all();
  
  return result.results || [];
}

/**
 * Add a business to the featured tier pool
 */
export async function addToFeaturedTier(
  env: any,
  businessId: number,
  tierLevel: 'free' | 'basic' | 'premium' = 'free',
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const db = env.DB;
  
  try {
    await db.prepare(`
      INSERT OR REPLACE INTO featured_tier_members 
      (business_id, tier_level, notes, tier_start)
      VALUES (?, ?, ?, ?)
    `).bind(businessId, tierLevel, notes || null, Math.floor(Date.now() / 1000)).run();
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Remove a business from the featured tier pool
 */
export async function removeFromFeaturedTier(
  env: any,
  businessId: number
): Promise<{ success: boolean; error?: string }> {
  const db = env.DB;
  
  try {
    // Set tier_end instead of deleting (for history)
    await db.prepare(`
      UPDATE featured_tier_members 
      SET tier_end = ?
      WHERE business_id = ? AND tier_end IS NULL
    `).bind(Math.floor(Date.now() / 1000), businessId).run();
    
    // Also remove from featured if currently featured
    await db.prepare(`
      UPDATE businesses SET is_featured = 0 WHERE id = ?
    `).bind(businessId).run();
    
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
