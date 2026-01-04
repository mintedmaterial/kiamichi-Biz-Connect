// Diagnostic script to check Facebook automation status
// Run this to see what's happening with your queue

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/diagnose-facebook') {
      const db = env.DB;
      
      // Check posting schedule
      const schedule = await db.prepare(`
        SELECT * FROM facebook_posting_schedule 
        WHERE is_active = 1 
        ORDER BY hour_utc, minute
      `).all();
      
      // Check current queue status
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - 300;
      const windowEnd = now + 300;
      
      const currentQueue = await db.prepare(`
        SELECT * FROM facebook_content_queue 
        WHERE scheduled_for >= ? AND scheduled_for <= ?
        AND status = 'pending'
        ORDER BY scheduled_for
      `).bind(windowStart, windowEnd).all();
      
      // Check total pending posts
      const totalPending = await db.prepare(`
        SELECT COUNT(*) as count FROM facebook_content_queue 
        WHERE status = 'pending'
      `).first();
      
      // Check recent posts
      const recentPosts = await db.prepare(`
        SELECT * FROM facebook_content_queue 
        WHERE status = 'posted' 
        AND posted_at > ?
        ORDER BY posted_at DESC
        LIMIT 5
      `).bind(now - 86400).all(); // Last 24 hours
      
      const result = {
        currentTime: new Date().toISOString(),
        currentHourUTC: new Date().getUTCHours(),
        postingHours: [3, 15, 22], // Your cron hours
        schedule: schedule.results,
        currentQueueWindow: `${new Date(windowStart * 1000).toISOString()} - ${new Date(windowEnd * 1000).toISOString()}`,
        currentQueuePosts: currentQueue.results,
        totalPending: totalPending?.count || 0,
        recentPosts: recentPosts.results,
        diagnosis: ""
      };
      
      // Simple diagnosis
      if (currentQueue.results.length === 0 && totalPending.count > 0) {
        result.diagnosis = "Posts exist but none scheduled for current time window. Check posting schedule vs cron timing.";
      } else if (totalPending.count === 0) {
        result.diagnosis = "No pending posts in queue. Content generation may not be working.";
      } else if (schedule.results.length === 0) {
        result.diagnosis = "No posting schedule configured. Run migration 004.";
      } else {
        result.diagnosis = "System appears configured. Check logs for posting errors.";
      }
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not found', { status: 404 });
  }
};