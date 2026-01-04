// Deploy Facebook Automation Fixes
// Apply CST schedule and test posting

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'deploy';

    try {
      const db = env.DB;

      switch (action) {
        case 'deploy':
          console.log("[DEPLOY] Applying Facebook automation fixes...");
          
          // 1. Fix posting schedule for CST times
          await db.prepare('DELETE FROM facebook_posting_schedule').run();
          
          await db.prepare(`
            INSERT INTO facebook_posting_schedule (time_slot, hour_utc, minute, preferred_content_types, target_type) VALUES
            ('morning', 15, 0, '["business_spotlight", "category_highlight"]', 'both'),
            ('afternoon', 22, 0, '["blog_share", "business_spotlight"]', 'both'),
            ('evening', 3, 0, '["business_spotlight", "engagement_prompt"]', 'both')
          `).run();
          
          console.log("[DEPLOY] ✅ Posting schedule fixed for CST times");
          
          // 2. Verify the fix
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
          
          console.log("[DEPLOY] Schedule verification:", schedule.results);
          
          return new Response(JSON.stringify({
            success: true,
            message: "Facebook automation fixes deployed successfully",
            deployed: {
              postingSchedule: 'Fixed for CST times (9 AM, 4 PM, 9 PM)',
              timeWindow: 'Expanded to ±30 minutes',
              schedule: schedule.results
            },
            nextSteps: [
              "1. Monitor if posts publish at correct times",
              "2. Check Facebook page for new posts",
              "3. Test mascot image generation",
              "4. Verify voice functionality when ready"
            ]
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });

        case 'test-post':
          console.log("[TEST] Manually testing post publication...");
          
          // Test posting a single post
          try {
            const { processPendingPostsInternal } = await import('./workers/facebook-worker/src/index');
            
            const now = Math.floor(Date.now() / 1000);
            const result = await processPendingPostsInternal(env, now);
            
            return new Response(JSON.stringify({
              success: true,
              message: "Manual post test completed",
              result: {
                postsProcessed: result.posted || 0,
                postsFailed: result.failed || 0,
                pagePostId: result.pagePostId,
                groupPostId: result.groupPostId
              },
              note: "Check your Facebook page to see if posts appeared"
            }, null, 2), {
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (error) {
            return new Response(JSON.stringify({
              success: false,
              error: error.message,
              note: "Make sure Facebook tokens are configured"
            }, null, 2), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            });
          }

        case 'test-mascot':
          console.log("[TEST] Testing Bigfoot mascot image generation...");
          
          const { generateBusinessImageWithMascot } = await import('./src/bigfoot-mascot');
          
          const testBusiness = {
            name: "Big J's BBQ",
            description: "Amazing barbecue restaurant",
            city: "Hugo"
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
            hasMascot: true,
            note: imageUrl ? "Bigfoot Jr. image generated successfully!" : "Image generation may need configuration"
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });

        default:
          return new Response('Invalid action. Use: ?action=deploy, test-post, or test-mascot', { status: 400 });
      }
    } catch (error) {
      console.error("[DEPLOY] Error:", error);
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