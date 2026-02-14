// Monitoring Dashboard Integration for Kiamichi Biz Connect
// Real-time system health monitoring and alerts
// Signed by: Atlas Rooty (AI Development Partner)

export interface SystemMetrics {
  timestamp: number;
  facebookWorker: {
    status: 'healthy' | 'warning' | 'error';
    lastPost: number;
    queueLength: number;
    errorRate: number;
  };
  voiceServer: {
    status: 'healthy' | 'warning' | 'error';
    connections: number;
    responseTime: number;
    errorRate: number;
  };
  database: {
    status: 'healthy' | 'warning' | 'error';
    queryTime: number;
    connections: number;
    lastBackup: number;
  };
  notifications: {
    unreadAlerts: number;
    lastAlert: number;
    severity: 'info' | 'warning' | 'error';
  };
}

export class MonitoringDashboard {
  private env: any;
  private metrics: SystemMetrics;
  private alertHistory: any[] = [];

  constructor(env: any) {
    this.env = env;
    this.metrics = this.initializeMetrics();
  }

  private initializeMetrics(): SystemMetrics {
    return {
      timestamp: Date.now(),
      facebookWorker: {
        status: 'healthy',
        lastPost: 0,
        queueLength: 0,
        errorRate: 0
      },
      voiceServer: {
        status: 'healthy',
        connections: 0,
        responseTime: 0,
        errorRate: 0
      },
      database: {
        status: 'healthy',
        queryTime: 0,
        connections: 0,
        lastBackup: 0
      },
      notifications: {
        unreadAlerts: 0,
        lastAlert: 0,
        severity: 'info'
      }
    };
  }

  async collectMetrics(): Promise<SystemMetrics> {
    try {
      // Collect Facebook Worker metrics
      const fbMetrics = await this.getFacebookWorkerMetrics();
      
      // Collect Voice Server metrics
      const voiceMetrics = await this.getVoiceServerMetrics();
      
      // Collect Database metrics
      const dbMetrics = await this.getDatabaseMetrics();
      
      // Collect notification status
      const notificationStatus = await this.getNotificationStatus();

      this.metrics = {
        timestamp: Date.now(),
        facebookWorker: fbMetrics,
        voiceServer: voiceMetrics,
        database: dbMetrics,
        notifications: notificationStatus
      };

      // Store metrics for historical tracking
      await this.storeMetrics();

      return this.metrics;

    } catch (error) {
      console.error("Failed to collect metrics:", error);
      throw error;
    }
  }

  private async getFacebookWorkerMetrics(): Promise<any> {
    try {
      const response = await fetch("https://kiamichi-facebook-worker.workers.dev/metrics");
      const data = await response.json();

      return {
        status: data.error_rate > 10 ? 'error' : data.error_rate > 5 ? 'warning' : 'healthy',
        lastPost: data.last_post_timestamp || 0,
        queueLength: data.queue_length || 0,
        errorRate: data.error_rate || 0
      };
    } catch (error) {
      return {
        status: 'error',
        lastPost: 0,
        queueLength: 0,
        errorRate: 100
      };
    }
  }

  private async getVoiceServerMetrics(): Promise<any> {
    try {
      const response = await fetch("https://app.kiamichibizconnect.com/voice/metrics");
      const data = await response.json();

      return {
        status: data.error_rate > 5 ? 'error' : data.error_rate > 2 ? 'warning' : 'healthy',
        connections: data.active_connections || 0,
        responseTime: data.avg_response_time || 0,
        errorRate: data.error_rate || 0
      };
    } catch (error) {
      return {
        status: 'error',
        connections: 0,
        responseTime: 0,
        errorRate: 100
      };
    }
  }

  private async getDatabaseMetrics(): Promise<any> {
    try {
      const start = Date.now();
      const result = await this.env.DB.prepare("SELECT COUNT(*) as count FROM businesses LIMIT 1").first();
      const queryTime = Date.now() - start;

      return {
        status: queryTime > 1000 ? 'error' : queryTime > 500 ? 'warning' : 'healthy',
        queryTime: queryTime,
        connections: 1, // Simplified for now
        lastBackup: 0 // Would need to track separately
      };
    } catch (error) {
      return {
        status: 'error',
        queryTime: 0,
        connections: 0,
        lastBackup: 0
      };
    }
  }

  private async getNotificationStatus(): Promise<any> {
    try {
      // Get unread alerts from KV storage
      const alerts = await this.env.ALERTS_KV.list({ prefix: "alert:" });
      const unreadAlerts = alerts.keys.filter(key => !key.metadata?.acknowledged).length;
      const lastAlert = alerts.keys.length > 0 ? parseInt(alerts.keys[0].name.split(":")[1]) : 0;

      // Determine severity from recent alerts
      let severity: 'info' | 'warning' | 'error' = 'info';
      if (await this.hasRecentErrorAlerts()) {
        severity = 'error';
      } else if (await this.hasRecentWarningAlerts()) {
        severity = 'warning';
      }

      return {
        unreadAlerts: unreadAlerts,
        lastAlert: lastAlert,
        severity: severity
      };
    } catch (error) {
      return {
        unreadAlerts: 0,
        lastAlert: 0,
        severity: 'info'
      };
    }
  }

  private async hasRecentErrorAlerts(): Promise<boolean> {
    const oneHourAgo = Date.now() - 3600000;
    const alerts = await this.env.ALERTS_KV.list({ prefix: "alert:" });
    
    for (const key of alerts.keys) {
      const alertData = await this.env.ALERTS_KV.get(key.name);
      if (alertData) {
        const alert = JSON.parse(alertData);
        if (alert.timestamp > oneHourAgo && alert.severity === "ERROR") {
          return true;
        }
      }
    }
    return false;
  }

  private async hasRecentWarningAlerts(): Promise<boolean> {
    const oneHourAgo = Date.now() - 3600000;
    const alerts = await this.env.ALERTS_KV.list({ prefix: "alert:" });
    
    for (const key of alerts.keys) {
      const alertData = await this.env.ALERTS_KV.get(key.name);
      if (alertData) {
        const alert = JSON.parse(alertData);
        if (alert.timestamp > oneHourAgo && alert.severity === "WARNING") {
          return true;
        }
      }
    }
    return false;
  }

  private async storeMetrics(): Promise<void> {
    try {
      const metricsData = JSON.stringify(this.metrics);
      const key = `metrics:${this.metrics.timestamp}`;
      
      await this.env.METRICS_KV.put(key, metricsData, {
        expirationTtl: 86400 * 7 // Store for 7 days
      });

      // Also store latest metrics for quick access
      await this.env.METRICS_KV.put("latest:metrics", metricsData);
    } catch (error) {
      console.error("Failed to store metrics:", error);
    }
  }

  async getDashboardData(): Promise<any> {
    try {
      await this.collectMetrics();
      
      return {
        current: this.metrics,
        alertHistory: await this.getAlertHistory(),
        performanceTrends: await this.getPerformanceTrends(),
        recommendations: this.generateRecommendations()
      };
    } catch (error) {
      console.error("Failed to get dashboard data:", error);
      throw error;
    }
  }

  private async getAlertHistory(): Promise<any[]> {
    try {
      const alerts = await this.env.ALERTS_KV.list({ prefix: "alert:" });
      const alertHistory = [];

      for (const key of alerts.keys) {
        const alertData = await this.env.ALERTS_KV.get(key.name);
        if (alertData) {
          alertHistory.push(JSON.parse(alertData));
        }
      }

      // Sort by timestamp, most recent first
      return alertHistory.sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    } catch (error) {
      console.error("Failed to get alert history:", error);
      return [];
    }
  }

  private async getPerformanceTrends(): Promise<any> {
    try {
      // Get metrics from last 24 hours
      const oneDayAgo = Date.now() - 86400000;
      const metrics = await this.env.METRICS_KV.list({ prefix: "metrics:" });
      
      const trends = {
        facebookErrorRate: [],
        voiceResponseTime: [],
        databaseQueryTime: [],
        timestamps: []
      };

      for (const key of metrics.keys) {
        const timestamp = parseInt(key.name.split(":")[1]);
        if (timestamp > oneDayAgo) {
          const metricData = await this.env.METRICS_KV.get(key.name);
          if (metricData) {
            const metric = JSON.parse(metricData);
            trends.timestamps.push(timestamp);
            trends.facebookErrorRate.push(metric.facebookWorker.errorRate);
            trends.voiceResponseTime.push(metric.voiceServer.responseTime);
            trends.databaseQueryTime.push(metric.database.queryTime);
          }
        }
      }

      return trends;
    } catch (error) {
      console.error("Failed to get performance trends:", error);
      return { timestamps: [], facebookErrorRate: [], voiceResponseTime: [], databaseQueryTime: [] };
    }
  }

  private generateRecommendations(): string[] {
    const recommendations = [];

    // Check Facebook worker
    if (this.metrics.facebookWorker.errorRate > 5) {
      recommendations.push("Facebook worker has high error rate - check queue processing");
    }
    if (this.metrics.facebookWorker.queueLength > 50) {
      recommendations.push("Large queue backlog - consider increasing worker capacity");
    }

    // Check voice server
    if (this.metrics.voiceServer.responseTime > 1000) {
      recommendations.push("Voice server response time is slow - check for bottlenecks");
    }
    if (this.metrics.voiceServer.errorRate > 2) {
      recommendations.push("Voice server has elevated error rate - investigate issues");
    }

    // Check database
    if (this.metrics.database.queryTime > 500) {
      recommendations.push("Database queries are slow - consider optimization");
    }

    // Check notifications
    if (this.metrics.notifications.unreadAlerts > 5) {
      recommendations.push("Multiple unread alerts - review system issues");
    }

    if (recommendations.length === 0) {
      recommendations.push("System is performing well - no immediate action needed");
    }

    return recommendations;
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    try {
      const alertData = await this.env.ALERTS_KV.get(`alert:${alertId}`);
      if (alertData) {
        const alert = JSON.parse(alertData);
        alert.acknowledged = true;
        alert.acknowledgedAt = Date.now();
        
        await this.env.ALERTS_KV.put(`alert:${alertId}`, JSON.stringify(alert));
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to acknowledge alert:", error);
      return false;
    }
  }
}

// Export for use in other files
export { MonitoringDashboard };