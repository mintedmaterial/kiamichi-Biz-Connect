// Fix posting schedule - apply this to D1 database
export async function fixPostingSchedule(env: any) {
  const db = env.DB;
  
  try {
    // Delete existing schedule
    await db.prepare('DELETE FROM facebook_posting_schedule').run();
    
    // Insert corrected schedule matching cron times
    // Cron runs at: 3, 15, 22 UTC
    await db.prepare(`
      INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
      ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both'),
      ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
      ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both')
    `).run();
    
    console.log("[Schedule Fix] Applied corrected posting schedule");
    return { success: true };
  } catch (error) {
    console.error("[Schedule Fix] Error:", error);
    return { success: false, error: error.message };
  }
}

// Test the fix
export async function testPostingSchedule(env: any) {
  const db = env.DB;
  
  try {
    const schedule = await db.prepare(`
      SELECT time_slot, hour_utc, minute, target_type 
      FROM facebook_posting_schedule 
      WHERE is_active = 1 
      ORDER BY hour_utc
    `).all();
    
    console.log("[Schedule Test] Current schedule:", schedule.results);
    
    // Check if we have posts scheduled for the right times
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - 1800; // 30 minutes ago
    const windowEnd = now + 1800; // 30 minutes from now
    
    const pendingPosts = await db.prepare(`
      SELECT COUNT(*) as count 
      FROM facebook_content_queue 
      WHERE status = 'pending' 
      AND scheduled_for >= ? 
      AND scheduled_for <= ?
    `).bind(windowStart, windowEnd).first();
    
    console.log("[Schedule Test] Pending posts in window:", pendingPosts?.count || 0);
    
    return { 
      success: true, 
      schedule: schedule.results,
      pendingPosts: pendingPosts?.count || 0
    };
  } catch (error) {
    console.error("[Schedule Test] Error:", error);
    return { success: false, error: error.message };
  }
}