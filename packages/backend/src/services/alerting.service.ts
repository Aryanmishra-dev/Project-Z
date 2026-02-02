/**
 * Alerting Service
 *
 * Monitors application health and sends alerts when thresholds are exceeded.
 * Supports multiple notification channels: console, webhook, email.
 */

import { redis } from '../config/redis';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  metric: MetricType;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds the condition must persist
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
}

export type MetricType =
  | 'error_rate'
  | 'response_time_p95'
  | 'response_time_p99'
  | 'memory_usage_percent'
  | 'request_count'
  | 'database_latency'
  | 'redis_latency'
  | 'nlp_latency';

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  metric: MetricType;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
  resolvedAt?: string;
  acknowledged: boolean;
}

interface AlertConfig {
  webhookUrl?: string;
  emailConfig?: {
    to: string[];
    from: string;
    smtpHost: string;
    smtpPort: number;
    username: string;
    password: string;
  };
  slackWebhook?: string;
  checkIntervalSeconds: number;
  cooldownSeconds: number; // Minimum time between alerts for same rule
}

// Default alert rules
const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'error-rate-warning',
    name: 'High Error Rate Warning',
    description: 'Error rate exceeds 5% for 5 minutes',
    metric: 'error_rate',
    condition: 'gt',
    threshold: 5,
    duration: 300,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'error-rate-critical',
    name: 'Critical Error Rate',
    description: 'Error rate exceeds 10% for 2 minutes',
    metric: 'error_rate',
    condition: 'gt',
    threshold: 10,
    duration: 120,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'response-time-warning',
    name: 'Slow Response Time Warning',
    description: 'P95 response time exceeds 500ms for 5 minutes',
    metric: 'response_time_p95',
    condition: 'gt',
    threshold: 500,
    duration: 300,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'response-time-critical',
    name: 'Critical Response Time',
    description: 'P95 response time exceeds 1000ms for 2 minutes',
    metric: 'response_time_p95',
    condition: 'gt',
    threshold: 1000,
    duration: 120,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'memory-warning',
    name: 'High Memory Usage Warning',
    description: 'Memory usage exceeds 80%',
    metric: 'memory_usage_percent',
    condition: 'gt',
    threshold: 80,
    duration: 60,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'memory-critical',
    name: 'Critical Memory Usage',
    description: 'Memory usage exceeds 95%',
    metric: 'memory_usage_percent',
    condition: 'gt',
    threshold: 95,
    duration: 30,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'database-latency',
    name: 'High Database Latency',
    description: 'Database latency exceeds 100ms for 3 minutes',
    metric: 'database_latency',
    condition: 'gt',
    threshold: 100,
    duration: 180,
    severity: 'warning',
    enabled: true,
  },
];

class AlertingService {
  private config: AlertConfig;
  private rules: AlertRule[];
  private activeAlerts: Map<string, Alert> = new Map();
  private metricsHistory: Map<MetricType, { value: number; timestamp: number }[]> = new Map();
  private lastAlertTime: Map<string, number> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<AlertConfig>) {
    this.config = {
      checkIntervalSeconds: 30,
      cooldownSeconds: 300,
      ...config,
    };
    this.rules = [...DEFAULT_RULES];
  }

  /**
   * Start the alerting service
   */
  start(): void {
    if (this.checkInterval) {
      return;
    }

    console.log('[Alerting] Starting alerting service...');
    this.checkInterval = setInterval(
      () => this.checkAlerts(),
      this.config.checkIntervalSeconds * 1000
    );
  }

  /**
   * Stop the alerting service
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('[Alerting] Alerting service stopped');
    }
  }

  /**
   * Record a metric value
   */
  recordMetric(metric: MetricType, value: number): void {
    const history = this.metricsHistory.get(metric) || [];
    history.push({ value, timestamp: Date.now() });

    // Keep only last 10 minutes of data
    const cutoff = Date.now() - 10 * 60 * 1000;
    const filtered = history.filter((h) => h.timestamp > cutoff);
    this.metricsHistory.set(metric, filtered);
  }

  /**
   * Add or update an alert rule
   */
  addRule(rule: AlertRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules = this.rules.filter((r) => r.id !== ruleId);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Check all alert rules
   */
  private async checkAlerts(): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const isTriggered = this.evaluateRule(rule);
      const existingAlert = this.activeAlerts.get(rule.id);

      if (isTriggered && !existingAlert) {
        // New alert
        await this.triggerAlert(rule);
      } else if (!isTriggered && existingAlert) {
        // Alert resolved
        await this.resolveAlert(existingAlert);
      }
    }
  }

  /**
   * Evaluate if a rule condition is met
   */
  private evaluateRule(rule: AlertRule): boolean {
    const history = this.metricsHistory.get(rule.metric) || [];
    if (history.length === 0) return false;

    const cutoff = Date.now() - rule.duration * 1000;
    const relevantHistory = history.filter((h) => h.timestamp > cutoff);

    if (relevantHistory.length === 0) return false;

    // Check if condition has been true for the entire duration
    return relevantHistory.every((h) =>
      this.checkCondition(h.value, rule.condition, rule.threshold)
    );
  }

  /**
   * Check a single condition
   */
  private checkCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * Trigger a new alert
   */
  private async triggerAlert(rule: AlertRule): Promise<void> {
    // Check cooldown
    const lastAlert = this.lastAlertTime.get(rule.id) || 0;
    if (Date.now() - lastAlert < this.config.cooldownSeconds * 1000) {
      return;
    }

    const history = this.metricsHistory.get(rule.metric) || [];
    const currentValue = history.length > 0 ? history[history.length - 1].value : 0;

    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: `${rule.description}. Current value: ${currentValue.toFixed(2)}, threshold: ${rule.threshold}`,
      metric: rule.metric,
      currentValue,
      threshold: rule.threshold,
      triggeredAt: new Date().toISOString(),
      acknowledged: false,
    };

    this.activeAlerts.set(rule.id, alert);
    this.lastAlertTime.set(rule.id, Date.now());

    // Store alert in Redis for persistence
    await this.persistAlert(alert);

    // Send notifications
    await this.sendNotifications(alert);

    console.log(`[Alerting] Alert triggered: ${rule.name} (${rule.severity})`);
  }

  /**
   * Resolve an active alert
   */
  private async resolveAlert(alert: Alert): Promise<void> {
    alert.resolvedAt = new Date().toISOString();

    // Store resolution in Redis
    await this.persistAlert(alert);

    this.activeAlerts.delete(alert.ruleId);

    console.log(`[Alerting] Alert resolved: ${alert.ruleName}`);
  }

  /**
   * Persist alert to Redis
   */
  private async persistAlert(alert: Alert): Promise<void> {
    try {
      const key = `alert:${alert.id}`;
      await redis.setex(key, 7 * 24 * 60 * 60, JSON.stringify(alert)); // 7 days retention

      // Add to alerts list
      await redis.lpush('alerts:list', alert.id);
      await redis.ltrim('alerts:list', 0, 999); // Keep last 1000 alerts
    } catch (error) {
      console.error('[Alerting] Failed to persist alert:', error);
    }
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert): Promise<void> {
    // Console logging (always enabled)
    const severityEmoji = {
      info: 'ℹ️',
      warning: '⚠️',
      critical: '🚨',
    };
    console.log(`${severityEmoji[alert.severity]} [ALERT] ${alert.ruleName}: ${alert.message}`);

    // Webhook notification
    if (this.config.webhookUrl) {
      await this.sendWebhook(alert);
    }

    // Slack notification
    if (this.config.slackWebhook) {
      await this.sendSlackNotification(alert);
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(alert: Alert): Promise<void> {
    if (!this.config.webhookUrl) return;

    try {
      await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert,
          timestamp: new Date().toISOString(),
          source: 'pdfquiz-alerting',
        }),
      });
    } catch (error) {
      console.error('[Alerting] Failed to send webhook:', error);
    }
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    if (!this.config.slackWebhook) return;

    const color = {
      info: '#2196f3',
      warning: '#ff9800',
      critical: '#f44336',
    };

    try {
      await fetch(this.config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [
            {
              color: color[alert.severity],
              title: `🔔 Alert: ${alert.ruleName}`,
              text: alert.message,
              fields: [
                { title: 'Severity', value: alert.severity.toUpperCase(), short: true },
                { title: 'Metric', value: alert.metric, short: true },
                { title: 'Current Value', value: alert.currentValue.toFixed(2), short: true },
                { title: 'Threshold', value: alert.threshold.toString(), short: true },
              ],
              footer: 'PDF Quiz Generator',
              ts: Math.floor(new Date(alert.triggeredAt).getTime() / 1000),
            },
          ],
        }),
      });
    } catch (error) {
      console.error('[Alerting] Failed to send Slack notification:', error);
    }
  }

  /**
   * Get alert history from Redis
   */
  async getAlertHistory(limit = 50): Promise<Alert[]> {
    try {
      const alertIds = await redis.lrange('alerts:list', 0, limit - 1);
      const alerts: Alert[] = [];

      for (const id of alertIds) {
        const alertData = await redis.get(`alert:${id}`);
        if (alertData) {
          alerts.push(JSON.parse(alertData));
        }
      }

      return alerts;
    } catch (error) {
      console.error('[Alerting] Failed to get alert history:', error);
      return [];
    }
  }
}

// Export singleton instance
export const alertingService = new AlertingService({
  checkIntervalSeconds: Number(process.env.ALERT_CHECK_INTERVAL) || 30,
  cooldownSeconds: Number(process.env.ALERT_COOLDOWN) || 300,
  webhookUrl: process.env.ALERT_WEBHOOK_URL,
  slackWebhook: process.env.ALERT_SLACK_WEBHOOK,
});

export default alertingService;
