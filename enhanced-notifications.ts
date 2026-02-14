# Enhanced Cloudflare Notifications for Kiamichi Biz Connect
# Security-focused monitoring with proper Cloudflare alert types
# Signed by: Atlas Rooty (AI Development Partner)

export interface EnhancedNotificationConfig {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  alert_type: string;
  filters: Record<string, any>;
  notification_channels: string[];
  recipients: Array<{
    type: 'email' | 'webhook' | 'pagerduty' | 'slack';
    address?: string;
    url?: string;
    webhook_url?: string;
  }>;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'SECURITY' | 'PERFORMANCE' | 'AVAILABILITY' | 'MONITORING';
  threshold?: number;
  cooldown_minutes?: number;
  escalation_enabled?: boolean;
  created_at?: number;
  updated_at?: number;
}

export class EnhancedNotificationManager {
  private accountId: string;
  private apiToken: string;
  private notifications: Map<string, EnhancedNotificationConfig> = new Map();

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }

  // Get all available Cloudflare alert types with proper categorization
  async getAvailableAlertsWithCategories(): Promise<Record<string, any[]>> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/available_alerts`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get available alerts: ${response.status}`);
      }

      const data = await response.json();
      
      // Categorize alerts by their purpose
      const categorized = {
        SECURITY: [] as any[],
        PERFORMANCE: [] as any[],
        AVAILABILITY: [] as any[],
        MONITORING: [] as any[],
        BILLING: [] as any[]
      };

      // Categorize based on alert type patterns and documentation
      for (const [category, alerts] of Object.entries(data.result)) {
        for (const alert of alerts) {
          // Categorize based on alert type patterns
          if (alert.type?.includes('bot') || alert.type?.includes('ddos') || alert.type?.includes('security')) {
            categorized.SECURITY.push({ category, ...alert });
          } else if (alert.type?.includes('performance') || alert.type?.includes('latency') || alert.type?.includes('error')) {
            categorized.PERFORMANCE.push({ category, ...alert });
          } else if (alert.type?.includes('maintenance') || alert.type?.includes('status') || alert.type?.includes('health')) {
            categorized.AVAILABILITY.push({ category, ...alert });
          } else if (alert.type?.includes('billing') || alert.type?.includes('usage')) {
            categorized.BILLING.push({ category, ...alert });
          } else {
            categorized.MONITORING.push({ category, ...alert });
          }
        }
      }

      return categorized;
    } catch (error) {
      console.error('Failed to get available alerts:', error);
      throw error;
    }
  }

  // Get enhanced notification templates for Kiamichi Biz Connect
  getEnhancedNotificationTemplates(): Record<string, EnhancedNotificationConfig> {
    return {
      // SECURITY ALERTS
      'security_analytics': {
        name: 'Security Analytics Alert',
        description: 'Security threats and attack patterns detected on Kiamichi domains',
        enabled: true,
        alert_type: 'security_analytics_alert', // Based on Cloudflare security analytics
        priority: 'HIGH',
        category: 'SECURITY',
        threshold: 50, // Number of security events
        cooldown_minutes: 30,
        escalation_enabled: true,
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com'],
          severity: 'medium', // medium, high, critical
          attack_types: ['bot', 'ddos', 'rate_limiting']
        },
        notification_channels: ['email', 'webhook'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          },
          {
            type: 'webhook',
            webhook_url: 'https://app.kiamichibizconnect.com/webhook/security-alert'
          }
        ]
      },

      'bot_detection': {
        name: 'Bot Detection Alert',
        description: 'Automated bot traffic detected on Kiamichi domains',
        enabled: true,
        alert_type: 'bot_detection_alert', // Cloudflare bot detection
        priority: 'MEDIUM',
        category: 'SECURITY',
        threshold: 200, // Bot requests per second
        cooldown_minutes: 60,
        escalation_enabled: false,
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com'],
          bot_types: ['automated', 'likely_automated']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      'ddos_protection': {
        name: 'DDoS Protection Alert',
        description: 'HTTP DDoS attacks mitigated by Cloudflare',
        enabled: true,
        alert_type: 'http_ddos_attack_alert', // Based on Cloudflare DDoS docs
        priority: 'HIGH',
        category: 'SECURITY',
        threshold: 100, // requests per second
        cooldown_minutes: 15,
        escalation_enabled: true,
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com'],
          impact_level: 'minor' // minor, major, critical
        },
        notification_channels: ['email', 'webhook'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          },
          {
            type: 'webhook',
            webhook_url: 'https://app.kiamichibizconnect.com/webhook/ddos-alert'
          }
        ]
      },

      // PERFORMANCE ALERTS
      'worker_performance': {
        name: 'Worker Performance Alert',
        description: 'Worker execution time and resource usage monitoring',
        enabled: true,
        alert_type: 'worker_performance_alert', // Custom worker performance
        priority: 'MEDIUM',
        category: 'PERFORMANCE',
        threshold: 1000, // milliseconds
        cooldown_minutes: 30,
        escalation_enabled: false,
        filters: {
          zones: ['kiamichi-facebook-worker.workers.dev', 'app.kiamichibizconnect.com'],
          metrics: ['execution_time', 'cpu_usage', 'memory_usage']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      'database_performance': {
        name: 'Database Performance Alert',
        description: 'D1 database query performance and connection issues',
        enabled: true,
        alert_type: 'database_performance_alert', // Custom database monitoring
        priority: 'MEDIUM',
        category: 'PERFORMANCE',
        threshold: 500, // milliseconds
        cooldown_minutes: 20,
        escalation_enabled: false,
        filters: {
          database_types: ['d1'],
          metrics: ['query_time', 'connection_count', 'error_rate']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      // AVAILABILITY ALERTS
      'origin_health': {
        name: 'Origin Health Alert',
        description: 'Origin server health and connectivity issues',
        enabled: true,
        alert_type: 'origin_health_alert', // Based on Cloudflare origin monitoring
        priority: 'HIGH',
        category: 'AVAILABILITY',
        threshold: 3, // consecutive failures
        cooldown_minutes: 10,
        escalation_enabled: true,
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com', 'kiamichi-facebook-worker.workers.dev'],
          health_check_types: ['tcp', 'http']
        },
        notification_channels: ['email', 'webhook'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          },
          {
            type: 'webhook',
            webhook_url: 'https://app.kiamichibizconnect.com/webhook/health-alert'
          }
        ]
      },

      'maintenance_alerts': {
        name: 'Maintenance Notifications',
        description: 'Cloudflare planned maintenance affecting Kiamichi services',
        enabled: true,
        alert_type: 'maintenance_notification', // Based on Cloudflare maintenance docs
        priority: 'LOW',
        category: 'AVAILABILITY',
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com'],
          maintenance_types: ['scheduled', 'changed', 'canceled'],
          data_centers: ['all'] // Specific data centers can be filtered
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      // MONITORING ALERTS
      'queue_monitoring': {
        name: 'Queue Processing Monitor',
        description: 'Facebook post queue processing and backlog monitoring',
        enabled: true,
        alert_type: 'custom_monitoring_alert', // Custom queue monitoring
        priority: 'MEDIUM',
        category: 'MONITORING',
        threshold: 50, // items in queue
        cooldown_minutes: 60,
        escalation_enabled: false,
        filters: {
          queue_types: ['facebook_posts'],
          metrics: ['queue_length', 'processing_time', 'error_rate']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      'voice_monitoring': {
        name: 'Voice System Monitor',
        description: 'Voice functionality health and error monitoring',
        enabled: true,
        alert_type: 'voice_monitoring_alert', // Custom voice monitoring
        priority: 'MEDIUM',
        category: 'MONITORING',
        threshold: 5, // error rate percentage
        cooldown_minutes: 30,
        escalation_enabled: false,
        filters: {
          voice_endpoints: ['/voice/stream', '/voice/test'],
          metrics: ['error_rate', 'response_time', 'connection_count']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      // BILLING ALERTS
      'usage_based_billing': {
        name: 'Usage-Based Billing Alert',
        description: 'Product usage approaching billing thresholds',
        enabled: true,
        alert_type: 'usage_based_billing', // Based on Cloudflare billing docs
        priority: 'LOW',
        category: 'BILLING',
        threshold: 80, // percentage of quota
        cooldown_minutes: 1440, // 24 hours
        escalation_enabled: false,
        filters: {
          products: ['workers', 'd1', 'kv', 'r2'],
          billing_types: ['usage_based']
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      }
    };
  }

  // Create enhanced notifications with proper Cloudflare integration
  async setupEnhancedNotifications(): Promise<{ success: boolean; results: any[]; summary: any }> {
    const templates = this.getEnhancedNotificationTemplates();
    const results = [];
    const summary = {
      total: 0,
      success: 0,
      failed: 0,
      by_category: {
        SECURITY: 0,
        PERFORMANCE: 0,
        AVAILABILITY: 0,
        MONITORING: 0,
        BILLING: 0
      }
    };

    for (const [key, config] of Object.entries(templates)) {
      try {
        // Validate configuration
        const validation = this.validateNotification(config);
        if (!validation.valid) {
          results.push({ 
            key, 
            success: false, 
            error: `Validation failed: ${validation.errors.join(', ')}` 
          });
          continue;
        }

        // Create the notification
        const result = await this.createNotification(config);
        
        results.push({ 
          key, 
          success: result.success, 
          id: result.id, 
          error: result.error,
          category: config.category,
          priority: config.priority
        });

        if (result.success) {
          summary.success++;
          summary.by_category[config.category as keyof typeof summary.by_category]++;
        }

      } catch (error) {
        results.push({ 
          key, 
          success: false, 
          error: error.message 
        });
      }
    }

    summary.total = Object.keys(templates).length;
    summary.failed = summary.total - summary.success;

    const allSuccess = summary.success === summary.total;
    return { success: allSuccess, results, summary };
  }

  // Validate notification configuration
  validateNotification(config: EnhancedNotificationConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.name || config.name.trim().length === 0) {
      errors.push('Name is required');
    }

    if (!config.alert_type || config.alert_type.trim().length === 0) {
      errors.push('Alert type is required');
    }

    if (!config.notification_channels || config.notification_channels.length === 0) {
      errors.push('At least one notification channel is required');
    }

    if (!config.recipients || config.recipients.length === 0) {
      errors.push('At least one recipient is required');
    }

    if (config.threshold !== undefined && (config.threshold < 0 || config.threshold > 100)) {
      errors.push('Threshold must be between 0 and 100');
    }

    if (config.cooldown_minutes !== undefined && config.cooldown_minutes < 0) {
      errors.push('Cooldown minutes must be positive');
    }

    // Validate recipients
    for (const recipient of config.recipients) {
      if (!recipient.type || !['email', 'webhook', 'pagerduty', 'slack'].includes(recipient.type)) {
        errors.push(`Invalid recipient type: ${recipient.type}`);
      }

      if (recipient.type === 'email' && !recipient.address) {
        errors.push('Email recipient requires an address');
      }

      if ((recipient.type === 'webhook' || recipient.type === 'slack') && !recipient.webhook_url) {
        errors.push('Webhook/Slack recipient requires a webhook_url');
      }
    }

    // Validate priority and category
    if (!['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(config.priority)) {
      errors.push('Invalid priority level');
    }

    if (!['SECURITY', 'PERFORMANCE', 'AVAILABILITY', 'MONITORING', 'BILLING'].includes(config.category)) {
      errors.push('Invalid category');
    }

    return { valid: errors.length === 0, errors };
  }

  // Get security analytics data for notifications
  async getSecurityAnalytics(zoneId: string): Promise<any> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/security/analytics`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get security analytics: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get security analytics:', error);
      throw error;
    }
  }

  // Create incident response workflow
  async createIncidentResponseWorkflow(notificationId: string, incident: any): Promise<void> {
    // This would integrate with external incident management systems
    // For now, just log and store the incident
    console.log(`[INCIDENT] ${incident.severity}: ${incident.message}`);
    
    // Store incident for dashboard visibility
    const incidentData = {
      notification_id: notificationId,
      timestamp: Date.now(),
      severity: incident.severity,
      message: incident.message,
      details: incident.details,
      acknowledged: false,
      resolved: false
    };

    // This would be stored in KV or external system
    console.log('Incident stored:', incidentData);
  }

  // Format notification for enhanced display
  formatEnhancedNotificationForDisplay(notification: EnhancedNotificationConfig): any {
    return {
      id: notification.id,
      name: notification.name,
      description: notification.description,
      status: notification.enabled ? 'Enabled' : 'Disabled',
      type: notification.alert_type,
      priority: notification.priority,
      category: notification.category,
      threshold: notification.threshold,
      cooldown: notification.cooldown_minutes,
      channels: notification.notification_channels.join(', '),
      recipients: notification.recipients.map(r => 
        r.type === 'email' ? r.address : 
        r.type === 'webhook' ? 'Webhook' : 
        r.type === 'slack' ? 'Slack' : r.type
      ).join(', '),
      escalation: notification.escalation_enabled ? 'Yes' : 'No',
      last_updated: notification.updated_at ? new Date(notification.updated_at).toLocaleString() : 'Never'
    };
  }
}