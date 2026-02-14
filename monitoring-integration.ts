// Complete Monitoring System Integration
// Combines notifications, dashboard, and health monitoring
// Signed by: Atlas Rooty (AI Development Partner)

import { setupCloudflareNotifications } from './cloudflare-notifications';
import { MonitoringDashboard } from './monitoring-dashboard';

export interface MonitoringConfig {
  enableNotifications: boolean;
  enableDashboard: boolean;
  enableHealthChecks: boolean;
  notificationEmail: string;
  checkInterval: number; // seconds
  alertThresholds: {
    workerErrors: number;
    queueBacklog: number;
    voiceErrors: number;
    responseTime: number;
  };
}

const DEFAULT_CONFIG: MonitoringConfig = {
  enableNotifications: true,
  enableDashboard: true,
  enableHealthChecks: true,
  notificationEmail: "colt@kiamichibizconnect.com",
  checkInterval: 300, // 5 minutes
  alertThresholds: {
    workerErrors: 10,      // 10 errors in 5 minutes
    queueBacklog: 50,     // 50 items in queue
    voiceErrors: 5,        // 5% error rate
    responseTime: 2000   // 2 seconds
  }
};

export class KiamichiMonitoring {
  private config: MonitoringConfig;
  private dashboard: MonitoringDashboard;
  private isInitialized: boolean = false;
  private healthCheckInterval: any = null;

  constructor(private env: any, config?: Partial<MonitoringConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dashboard = new MonitoringDashboard(env);
  }

  async initialize(): Promise<void> {
    try {
      console.log("[Monitoring] Initializing Kiamichi monitoring system...");

      // Setup Cloudflare notifications
      if (this.config.enableNotifications) {
        await this.setupNotifications();
      }

      // Initialize dashboard
      if (this.config.enableDashboard) {
        await this.initializeDashboard();
      }

      // Start health checks
      if (this.config.enableHealthChecks) {
        await this.startHealthChecks();
      }

      this.isInitialized = true;
      console.log("[Monitoring] System initialized successfully");

    } catch (error) {
      console.error("[Monitoring] Failed to initialize:", error);
      throw error;
    }
  }

  private async setupNotifications(): Promise<void> {
    try {
      console.log("[Monitoring] Setting up Cloudflare notifications...");
      
      const result = await setupCloudflareNotifications(this.env);
      
      if (result.success) {
        console.log("[Monitoring] Cloudflare notifications configured");
      } else {
        console.warn("[Monitoring] Cloudflare notifications setup failed:", result.error);
      }
    } catch (error) {
      console.error("[Monitoring] Failed to setup notifications:", error);
    }
  }

  private async initializeDashboard(): Promise<void> {
    try {
      console.log("[Monitoring] Initializing dashboard...");
      
      // Collect initial metrics
      await this.dashboard.collectMetrics();
      
      console.log("[Monitoring] Dashboard initialized");
    } catch (error) {
      console.error("[Monitoring] Failed to initialize dashboard:", error);
    }
  }

  private async startHealthChecks(): Promise<void> {
    try {
      console.log("[Monitoring] Starting health checks...");
      
      // Run initial health check
      await this.runHealthCheck();
      
      // Start periodic health checks
      this.healthCheckInterval = setInterval(async () => {
        await this.runHealthCheck();
      }, this.config.checkInterval * 1000);
      
      console.log(`[Monitoring] Health checks started (interval: ${this.config.checkInterval}s)`);
    } catch (error) {
      console.error("[Monitoring] Failed to start health checks:", error);
    }
  }

  async runHealthCheck(): Promise<void> {
    try {
      console.log("[Monitoring] Running health check...");

      // Collect current metrics
      const metrics = await this.dashboard.collectMetrics();
      
      // Check for issues
      const issues = await this.checkForIssues(metrics);
      
      // Handle any issues found
      if (issues.length > 0) {
        await this.handleIssues(issues);
      }

      // Store health status
      await this.storeHealthStatus(metrics, issues);

      console.log("[Monitoring] Health check completed");

    } catch (error) {
      console.error("[Monitoring] Health check failed:", error);
    }
  }

  private async checkForIssues(metrics: any): Promise<any[]> {
    const issues = [];

    // Check Facebook worker
    if (metrics.facebookWorker.errorRate > this.config.alertThresholds.workerErrors) {
      issues.push({
        type: "worker_errors",
        severity: "ERROR",
        service: "facebook_worker",
        message: `High error rate: ${metrics.facebookWorker.errorRate}%`,
        timestamp: Date.now()
      });
    }

    if (metrics.facebookWorker.queueLength > this.config.alertThresholds.queueBacklog) {
      issues.push({
        type: "queue_backlog",
        severity: "WARNING",
        service: "facebook_worker",
        message: `Large queue backlog: ${metrics.facebookWorker.queueLength} items`,
        timestamp: Date.now()
      });
    }

    // Check voice server
    if (metrics.voiceServer.errorRate > this.config.alertThresholds.voiceErrors) {
      issues.push({
        type: "voice_errors",
        severity: "ERROR",
        service: "voice_server",
        message: `High voice error rate: ${metrics.voiceServer.errorRate}%`,
        timestamp: Date.now()
      });
    }

    if (metrics.voiceServer.responseTime > this.config.alertThresholds.responseTime) {
      issues.push({
        type: "slow_response",
        severity: "WARNING",
        service: "voice_server",
        message: `Slow voice response: ${metrics.voiceServer.responseTime}ms`,
        timestamp: Date.now()
      });
    }

    // Check database
    if (metrics.database.queryTime > 1000) {
      issues.push({
        type: "database_slow",
        severity: "WARNING",
        service: "database",
        message: `Slow database queries: ${metrics.database.queryTime}ms`,
        timestamp: Date.now()
      });
    }

    return issues;
  }

  private async handleIssues(issues: any[]): Promise<void> {
    for (const issue of issues) {
      console.error(`[Monitoring] Issue detected: ${issue.message}`);
      
      // Store alert
      await this.storeAlert(issue);
      
      // Send notification if configured
      if (this.config.enableNotifications) {
        await this.sendNotification(issue);
      }
    }
  }

  private async storeAlert(issue: any): Promise<void> {
    try {
      const alertId = `alert:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
      const alertData = {
        ...issue,
        acknowledged: false,
        createdAt: Date.now()
      };

      await this.env.ALERTS_KV.put(alertId, JSON.stringify(alertData), {
        expirationTtl: 86400 * 7 // Store for 7 days
      });

      console.log(`[Monitoring] Alert stored: ${alertId}`);
    } catch (error) {
      console.error("[Monitoring] Failed to store alert:", error);
    }
  }

  private async sendNotification(issue: any): Promise<void> {
    // This would integrate with external notification systems
    // For now, just log the notification
    console.log(`[Notification] ${issue.severity}: ${issue.message}`);
    
    // In a full implementation, this would send to:
    // - Email
    // - Slack
    // - SMS for critical alerts
    // - Webhook to external systems
  }

  private async storeHealthStatus(metrics: any, issues: any[]): Promise<void> {
    try {
      const healthStatus = {
        timestamp: Date.now(),
        metrics,
        issues,
        overallStatus: issues.length === 0 ? 'healthy' : 
                      issues.some(i => i.severity === 'ERROR') ? 'error' : 'warning'
      };

      await this.env.HEALTH_KV.put('latest:health', JSON.stringify(healthStatus));
      
      console.log(`[Monitoring] Health status stored: ${healthStatus.overallStatus}`);
    } catch (error) {
      console.error("[Monitoring] Failed to store health status:", error);
    }
  }

  async getDashboardData(): Promise<any> {
    if (!this.isInitialized) {
      throw new Error("Monitoring system not initialized");
    }

    return await this.dashboard.getDashboardData();
  }

  async getHealthStatus(): Promise<any> {
    try {
      const healthData = await this.env.HEALTH_KV.get('latest:health');
      return healthData ? JSON.parse(healthData) : null;
    } catch (error) {
      console.error("[Monitoring] Failed to get health status:", error);
      return null;
    }
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    return await this.dashboard.acknowledgeAlert(alertId);
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.isInitialized = false;
    console.log("[Monitoring] System stopped");
  }
}

// Export for use in workers
export { KiamichiMonitoring };

// Default export
export default KiamichiMonitoring;