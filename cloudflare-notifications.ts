# Cloudflare Notifications Setup for Kiamichi Biz Connect
# Automated monitoring system for workers and services
# Signed by: Atlas Rooty (AI Development Partner)

## NOTIFICATION PRIORITIES FOR OUR SYSTEM

## HIGH PRIORITY - Immediate alerts
# 1. Worker errors (5xx errors)
# 2. D1 database errors  
# 3. KV storage issues
# 4. Facebook API failures

## MEDIUM PRIORITY - Performance issues
# 1. High error rates
# 2. Slow response times
# 3. Queue processing delays
# 4. Rate limiting issues

## LOW PRIORITY - Monitoring
# 1. Daily summaries
# 2. Performance metrics
# 3. Usage statistics

# Configuration for different notification types
export const NOTIFICATION_CONFIGS = {
  // High Priority - Immediate alerts
  worker_errors: {
    name: "Worker 5xx Errors",
    description: "High levels of 5xx HTTP errors in workers",
    type: "http_alert_origin_error",
    threshold: 10, // errors in 5 minutes
    priority: "HIGH",
    enabled: true,
    filters: {
      zones: ["kiamichibizconnect.com", "app.kiamichibizconnect.com"],
      slo: "99.7"
    }
  },

  facebook_worker_down: {
    name: "Facebook Worker Down",
    description: "Facebook automation worker not responding",
    type: "http_alert_origin_error", 
    threshold: 3, // consecutive failures
    priority: "HIGH",
    enabled: true,
    filters: {
      zones: ["kiamichi-facebook-worker.workers.dev"]
    }
  },

  voice_server_down: {
    name: "Voice Server Down", 
    description: "Voice functionality not responding",
    type: "http_alert_origin_error",
    threshold: 3,
    priority: "HIGH", 
    enabled: true,
    filters: {
      zones: ["app.kiamichibizconnect.com"]
    }
  },

  // Medium Priority - Performance issues
  high_error_rate: {
    name: "High Error Rate",
    description: "Error rate above acceptable threshold",
    type: "http_alert_origin_error",
    threshold: 5, // percentage
    priority: "MEDIUM",
    enabled: true,
    filters: {
      zones: ["kiamichibizconnect.com", "app.kiamichibizconnect.com"],
      slo: "99.8"
    }
  },

  queue_processing_slow: {
    name: "Queue Processing Slow",
    description: "Facebook post queue processing slower than expected",
    type: "custom_alert",
    threshold: 300, // seconds
    priority: "MEDIUM",
    enabled: true
  },

  // Low Priority - Monitoring
  daily_summary: {
    name: "Daily System Summary",
    description: "Daily summary of system health and metrics",
    type: "daily_digest",
    priority: "LOW",
    enabled: true,
    schedule: "0 8 * * *" // 8 AM daily
  },

  weekly_performance: {
    name: "Weekly Performance Report",
    description: "Weekly performance and usage statistics",
    type: "weekly_digest",
    priority: "LOW",
    enabled: true,
    schedule: "0 9 * * 1" // 9 AM Monday
  }
};

// Notification setup functions
export async function setupCloudflareNotifications(env: any) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  
  if (!accountId || !apiToken) {
    console.warn("Cloudflare API credentials not configured");
    return;
  }

  try {
    // Get available alerts
    const availableResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/alerting/v3/available_alerts`,
      {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!availableResponse.ok) {
      throw new Error(`Failed to get available alerts: ${availableResponse.status}`);
    }

    const availableAlerts = await availableResponse.json();
    console.log("Available Cloudflare alerts:", Object.keys(availableAlerts.result));

    // Set up notifications for each configured alert
    for (const [key, config] of Object.entries(NOTIFICATION_CONFIGS)) {
      if (config.enabled) {
        await createNotification(accountId, apiToken, config, key);
      }
    }

    return { success: true, message: "Notifications configured successfully" };

  } catch (error) {
    console.error("Failed to setup notifications:", error);
    return { success: false, error: error.message };
  }
}

async function createNotification(accountId: string, apiToken: string, config: any, key: string) {
  try {
    const notificationData = {
      name: config.name,
      description: config.description,
      enabled: true,
      alert_type: config.type,
      filters: config.filters || {},
      notification_channels: ["email"], // Can add "webhook", "pagerduty" later
      recipients: [
        {
          type: "email",
          address: "colt@kiamichibizconnect.com" // Update with actual email
        }
      ]
    };

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/alerting/v3/destinations`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(notificationData)
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to create notification ${key}: ${response.status}`);
    }

    console.log(`✅ Created notification: ${config.name}`);
    return await response.json();

  } catch (error) {
    console.error(`Failed to create notification ${key}:`, error);
    throw error;
  }
}

// Custom monitoring function for our specific needs
export async function monitorSystemHealth(env: any) {
  const checks = {
    facebook_worker: await checkFacebookWorkerHealth(env),
    voice_server: await checkVoiceServerHealth(env),
    database: await checkDatabaseHealth(env),
    queue_status: await checkQueueStatus(env)
  };

  // Log health status
  console.log("[Health Check] System status:", checks);

  // Alert if any critical services are down
  const criticalIssues = Object.entries(checks)
    .filter(([_, status]) => status.status === "ERROR")
    .map(([service, _]) => service);

  if (criticalIssues.length > 0) {
    await sendAlertNotification(env, "CRITICAL", `Services down: ${criticalIssues.join(", ")}`);
  }

  return checks;
}

async function checkFacebookWorkerHealth(env: any): Promise<{status: string, details: any}> {
  try {
    const response = await fetch("https://kiamichi-facebook-worker.workers.dev/health");
    if (!response.ok) {
      return { status: "ERROR", details: `HTTP ${response.status}` };
    }
    return { status: "OK", details: "Facebook worker responding" };
  } catch (error) {
    return { status: "ERROR", details: error.message };
  }
}

async function checkVoiceServerHealth(env: any): Promise<{status: string, details: any}> {
  try {
    const response = await fetch("https://app.kiamichibizconnect.com/voice/test");
    if (!response.ok) {
      return { status: "ERROR", details: `HTTP ${response.status}` };
    }
    return { status: "OK", details: "Voice server responding" };
  } catch (error) {
    return { status: "ERROR", details: error.message };
  }
}

async function checkDatabaseHealth(env: any): Promise<{status: string, details: any}> {
  try {
    // Test database connection
    const db = env.DB;
    const result = await db.prepare("SELECT COUNT(*) as count FROM businesses LIMIT 1").first();
    return { status: "OK", details: `Database connected, ${result.count} businesses` };
  } catch (error) {
    return { status: "ERROR", details: error.message };
  }
}

async function checkQueueStatus(env: any): Promise<{status: string, details: any}> {
  try {
    const response = await fetch("https://kiamichi-facebook-worker.workers.dev/queue-status");
    const data = await response.json();
    
    if (data.pending_count > 50) {
      return { status: "WARNING", details: `High queue: ${data.pending_count} pending` };
    }
    
    return { status: "OK", details: `Queue normal: ${data.pending_count} pending` };
  } catch (error) {
    return { status: "ERROR", details: error.message };
  }
}

async function sendAlertNotification(env: any, severity: string, message: string) {
  // Send immediate alert (can be extended to Slack, email, etc.)
  console.error(`[ALERT ${severity}] ${message}`);
  
  // Store in KV for dashboard visibility
  const alertData = {
    timestamp: Date.now(),
    severity,
    message,
    acknowledged: false
  };
  
  await env.ALERTS_KV.put(`alert:${Date.now()}`, JSON.stringify(alertData));
}