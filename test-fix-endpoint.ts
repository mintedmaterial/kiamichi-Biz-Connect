// Test endpoint to apply Facebook posting schedule fix
// Deploy this to test the automation

import { fixPostingSchedule, testPostingSchedule } from '../src/facebook-schedule-fix';

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Apply the schedule fix
      if (path === '/fix-schedule') {
        console.log("[Fix Schedule] Applying posting schedule fix...");
        
        const fixResult = await fixPostingSchedule(env);
        
        if (fixResult.success) {
          // Test the fix
          const testResult = await testPostingSchedule(env);
          
          return new Response(JSON.stringify({
            success: true,
            message: "Posting schedule fix applied successfully",
            fixResult,
            testResult
          }, null, 2), {
            headers: { 'Content-Type': 'application/json' }
          });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: fixResult.error
          }, null, 2), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Test current status
      if (path === '/test-schedule') {
        console.log("[Test Schedule] Testing current posting schedule...");
        
        const testResult = await testPostingSchedule(env);
        
        return new Response(JSON.stringify(testResult, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Manual trigger for testing
      if (path === '/trigger-posts') {
        console.log("[Trigger Posts] Manually triggering post processing...");
        
        const now = Math.floor(Date.now() / 1000);
        
        // Import the queue processing function
        const { processPendingPostsInternal } = await import('./workers/facebook-worker/src/index');
        
        const result = await processPendingPostsInternal(env, now);
        
        return new Response(JSON.stringify({
          success: true,
          message: "Manual post processing completed",
          result
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