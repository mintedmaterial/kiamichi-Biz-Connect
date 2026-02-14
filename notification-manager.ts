# Cloudflare Notification Management System
# Complete lifecycle management for notifications
# Signed by: Atlas Rooty (AI Development Partner)

export interface NotificationConfig {
  id?: string;
  name: string;
  description: string;
  enabled: boolean;
  alert_type: string;
  filters: Record<string, any>;
  notification_channels: string[];
  recipients: Array<{
    type: 'email' | 'webhook' | 'pagerduty';
    address?: string;
    url?: string;
  }>;
  created_at?: number;
  updated_at?: number;
  test_mode?: boolean;
}

export class NotificationManager {
  private accountId: string;
  private apiToken: string;
  private notifications: Map<string, NotificationConfig> = new Map();

  constructor(accountId: string, apiToken: string) {
    this.accountId = accountId;
    this.apiToken = apiToken;
  }

  // Get all available alert types from Cloudflare
  async getAvailableAlerts(): Promise<any> {
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
      return data.result;
    } catch (error) {
      console.error('Failed to get available alerts:', error);
      throw error;
    }
  }

  // Get all existing notifications
  async getNotifications(): Promise<NotificationConfig[]> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/destinations`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get notifications: ${response.status}`);
      }

      const data = await response.json();
      return data.result || [];
    } catch (error) {
      console.error('Failed to get notifications:', error);
      throw error;
    }
  }

  // Create a new notification
  async createNotification(config: NotificationConfig): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const notificationData = {
        name: config.name,
        description: config.description,
        enabled: config.enabled,
        alert_type: config.alert_type,
        filters: config.filters,
        notification_channels: config.notification_channels,
        recipients: config.recipients
      };

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/destinations`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(notificationData)
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true, id: result.result.id };
      } else {
        return { 
          success: false, 
          error: result.errors?.[0]?.message || 'Failed to create notification' 
        };
      }
    } catch (error) {
      console.error('Failed to create notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Update an existing notification
  async updateNotification(id: string, updates: Partial<NotificationConfig>): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData = {
        name: updates.name,
        description: updates.description,
        enabled: updates.enabled,
        filters: updates.filters,
        notification_channels: updates.notification_channels,
        recipients: updates.recipients
      };

      // Remove undefined values
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/destinations/${id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.errors?.[0]?.message || 'Failed to update notification' 
        };
      }
    } catch (error) {
      console.error('Failed to update notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete a notification
  async deleteNotification(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/destinations/${id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        return { success: true };
      } else {
        const result = await response.json();
        return { 
          success: false, 
          error: result.errors?.[0]?.message || 'Failed to delete notification' 
        };
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Enable/disable a notification
  async toggleNotification(id: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
    return await this.updateNotification(id, { enabled });
  }

  // Test a notification
  async testNotification(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/alerting/v3/destinations/${id}/test`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = await response.json();

      if (response.ok && result.success) {
        return { success: true };
      } else {
        return { 
          success: false, 
          error: result.errors?.[0]?.message || 'Failed to test notification' 
        };
      }
    } catch (error) {
      console.error('Failed to test notification:', error);
      return { success: false, error: error.message };
    }
  }

  // Get predefined notification templates for Kiamichi Biz Connect
  getNotificationTemplates(): Record<string, NotificationConfig> {
    return {
      // High Priority Alerts
      'worker_errors': {
        name: 'Kiamichi Worker Errors',
        description: 'High levels of 5xx HTTP errors in Kiamichi workers',
        enabled: true,
        alert_type: 'http_alert_origin_error',
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com', 'kiamichi-facebook-worker.workers.dev'],
          slo: '99.7'
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      'facebook_worker_down': {
        name: 'Facebook Automation Monitor',
        description: 'Facebook posting automation system status',
        enabled: true,
        alert_type: 'http_alert_origin_error',
        filters: {
          zones: ['kiamichi-facebook-worker.workers.dev'],
          slo: '99.8'
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      'voice_server_down': {
        name: 'Voice System Monitor',
        description: 'Voice functionality status monitoring',
        enabled: true,
        alert_type: 'http_alert_origin_error',
        filters: {
          zones: ['app.kiamichibizconnect.com'],
          slo: '99.8'
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      // Medium Priority Alerts
      'high_error_rate': {
        name: 'High Error Rate',
        description: 'Error rate above acceptable threshold',
        enabled: true,
        alert_type: 'http_alert_origin_error',
        filters: {
          zones: ['kiamichibizconnect.com', 'app.kiamichibizconnect.com'],
          slo: '99.8'
        },
        notification_channels: ['email'],
        recipients: [
          {
            type: 'email',
            address: 'colt@kiamichibizconnect.com'
          }
        ]
      },

      // Low Priority Monitoring
      'daily_summary': {
        name: 'Daily System Summary',
        description: 'Daily summary of system health and metrics',
        enabled: true,
        alert_type: 'daily_digest',
        filters: {},
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

  // Create all standard notifications for Kiamichi Biz Connect
  async setupStandardNotifications(): Promise<{ success: boolean; results: any[] }> {
    const templates = this.getNotificationTemplates();
    const results = [];

    for (const [key, config] of Object.entries(templates)) {
      try {
        const result = await this.createNotification(config);
        results.push({ key, success: result.success, id: result.id, error: result.error });
      } catch (error) {
        results.push({ key, success: false, error: error.message });
      }
    }

    const allSuccess = results.every(r => r.success);
    return { success: allSuccess, results };
  }

  // Get notification by ID
  async getNotification(id: string): Promise<NotificationConfig | null> {
    try {
      const notifications = await this.getNotifications();
      return notifications.find(n => n.id === id) || null;
    } catch (error) {
      console.error('Failed to get notification:', error);
      return null;
    }
  }

  // Validate notification configuration
  validateNotification(config: NotificationConfig): { valid: boolean; errors: string[] } {
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

    // Validate recipients
    for (const recipient of config.recipients) {
      if (!recipient.type || !['email', 'webhook', 'pagerduty'].includes(recipient.type)) {
        errors.push(`Invalid recipient type: ${recipient.type}`);
      }

      if (recipient.type === 'email' && !recipient.address) {
        errors.push('Email recipient requires an address');
      }

      if (recipient.type === 'webhook' && !recipient.url) {
        errors.push('Webhook recipient requires a URL');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Format notification for display
  formatNotificationForDisplay(notification: NotificationConfig): any {
    return {
      id: notification.id,
      name: notification.name,
      description: notification.description,
      status: notification.enabled ? 'Enabled' : 'Disabled',
      type: notification.alert_type,
      channels: notification.notification_channels.join(', '),
      recipients: notification.recipients.map(r => 
        r.type === 'email' ? r.address : r.type
      ).join(', '),
      last_updated: notification.updated_at ? new Date(notification.updated_at).toLocaleString() : 'Never'
    };
  }
}