// Test Facebook Automation - Manual Trigger
// Use this to test if posts are publishing correctly

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Test current queue status
      if (path === '/test-queue') {
        console.log("[Test Queue] Checking current queue status...");
        
        const db = env.DB;
        const now = Math.floor(Date.now() / 1000);
        
        // Check posting schedule
        const schedule = await db.prepare(`
          SELECT time_slot, hour_utc, minute, target_type 
          FROM facebook_posting_schedule 
          WHERE is_active = 1 
          ORDER BY hour_utc
        `).all();
        
        // Check current time window (±30 minutes for testing)
        const windowStart = now - 1800; // 30 minutes ago
        const windowEnd = now + 1800; // 30 minutes from now
        
        const pendingPosts = await db.prepare(`
          SELECT COUNT(*) as count 
          FROM facebook_content_queue 
          WHERE status = 'pending' 
          AND scheduled_for >= ? 
          AND scheduled_for <= ?
        `).bind(windowStart, windowEnd).first();
        
        // Check total pending posts
        const totalPending = await db.prepare(`
          SELECT COUNT(*) as total 
          FROM facebook_content_queue 
          WHERE status = 'pending'
        `).first();
        
        // Check recent posts
        const recentPosts = await db.prepare(`
          SELECT id, content_type, business_id, status, scheduled_for, posted_at
          FROM facebook_content_queue 
          WHERE status = 'posted' 
          AND posted_at > ?
          ORDER BY posted_at DESC
          LIMIT 5
        `).bind(now - 86400).all(); // Last 24 hours
        
        return new Response(JSON.stringify({
          success: true,
          currentTime: new Date().toISOString(),
          currentHourUTC: new Date().getUTCHours(),
          desiredTimes: ['3 AM', '3 PM', '10 PM'], // UTC times
          schedule: schedule.results,
          window: {
            start: new Date(windowStart * 1000).toISOString(),
            end: new Date(windowEnd * 1000).toISOString()
          },
          pendingInWindow: pendingPosts?.count || 0,
          totalPending: totalPending?.total || 0,
          recentPosts: recentPosts.results,
          nextSteps: [
            'Check if posts are scheduled for correct UTC times (3, 15, 22)',
            'Verify cron jobs are running at these times',
            'Test manual posting to verify system works'
          ]
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Manual trigger for testing
      if (path === '/trigger-posts') {
        console.log("[Trigger Posts] Manually triggering post processing...");
        
        // Import the queue processing function from facebook worker
        const { processPendingPostsInternal } = await import('./workers/facebook-worker/src/index');
        
        const now = Math.floor(Date.now() / 1000);
        const result = await processPendingPostsInternal(env, now);
        
        return new Response(JSON.stringify({
          success: true,
          message: "Manual post processing triggered",
          result: {
            posted: result.posted || 0,
            failed: result.failed || 0,
            pagePostId: result.pagePostId,
            groupPostId: result.groupPostId
          },
          timestamp: new Date().toISOString()
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Test image generation with mascot
      if (path === '/test-mascot') {
        console.log("[Test Mascot] Testing Bigfoot mascot image generation...");
        
        // Test the mascot system
        const { generateBusinessImageWithMascot } = await import('./src/bigfoot-mascot');
        
        const testBusiness = {
          name: "Big J's BBQ",
          description: "Amazing barbecue restaurant",
          city: "Hugo",
          id: 1
        };
        
        const imageUrl = await generateBusinessImageWithMascot(
          env,
          'restaurant',
          'Hugo, Oklahoma',
          testBusiness.name,
          true // Include mascot
        );
        
        return new Response(JSON.stringify({
          success: true,
          message: "Mascot image generation test completed",
          business: testBusiness.name,
          imageUrl: imageUrl,
          hasMascot: true
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Fix posting schedule
      if (path === '/fix-schedule') {
        console.log("[Fix Schedule] Applying corrected posting schedule...");
        
        const db = env.DB;
        
        // Delete existing schedule
        await db.prepare('DELETE FROM facebook_posting_schedule').run();
        
        // Insert corrected schedule for CST times
        await db.prepare(`
          INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
          ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
          ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both'),
          ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both')
        `).run();
        
        // Verify the fix
        const schedule = await db.prepare(`
          SELECT time_slot, hour_utc, minute,
             CASE 
               WHEN hour_utc = 15 THEN '9 AM CST'
               WHEN hour_utc = 22 THEN '4 PM CST' 
               WHEN hour_utc = 3 THEN '9 PM CST'
             END as cst_time
          FROM facebook_posting_schedule 
          ORDER BY hour_utc
        `).all();
        
        return new Response(JSON.stringify({
          success: true,
          message: "Posting schedule fixed for CST times",
          schedule: schedule.results,
          cstTimes: ['9 AM', '4 PM', '9 PM'],
          utcTimes: ['15:00', '22:00', '03:00']
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error("[Test Endpoint] Error:", error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};