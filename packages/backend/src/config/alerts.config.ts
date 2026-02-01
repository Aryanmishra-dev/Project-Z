/**
 * Alert Configuration
 * 
 * Defines alert rules, thresholds, and notification settings.
 * Email alerts are sent via configured SMTP server.
 */

import { AlertRule } from '../services/alerting.service';

// Email configuration
export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  recipients: string[];
}

export const emailConfig: EmailConfig = {
  enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
  from: process.env.ALERT_FROM_EMAIL || 'alerts@pdfquizgen.com',
  recipients: (process.env.ALERT_RECIPIENTS || '').split(',').filter(Boolean),
};

// Alert rules configuration
export const alertRules: AlertRule[] = [
  // 1. Error rate > 5% for 5 minutes → Email alert
  {
    id: 'error-rate-5percent',
    name: 'High Error Rate (5%)',
    description: 'API error rate exceeded 5% for 5 minutes',
    metric: 'error_rate',
    condition: 'gt',
    threshold: 5,
    duration: 300, // 5 minutes
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'error-rate-10percent',
    name: 'Critical Error Rate (10%)',
    description: 'API error rate exceeded 10% for 2 minutes - immediate attention required',
    metric: 'error_rate',
    condition: 'gt',
    threshold: 10,
    duration: 120, // 2 minutes
    severity: 'critical',
    enabled: true,
  },

  // 2. API p95 > 1s for 10 minutes → Email alert
  {
    id: 'response-time-p95-1s',
    name: 'Slow API Response (P95 > 1s)',
    description: 'API P95 response time exceeded 1 second for 10 minutes',
    metric: 'response_time_p95',
    condition: 'gt',
    threshold: 1000, // 1000ms = 1s
    duration: 600, // 10 minutes
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'response-time-p95-2s',
    name: 'Critical API Response (P95 > 2s)',
    description: 'API P95 response time exceeded 2 seconds for 5 minutes',
    metric: 'response_time_p95',
    condition: 'gt',
    threshold: 2000, // 2000ms = 2s
    duration: 300, // 5 minutes
    severity: 'critical',
    enabled: true,
  },

  // 3. Disk usage > 80% → Email alert
  {
    id: 'disk-usage-80percent',
    name: 'High Disk Usage (80%)',
    description: 'Disk usage exceeded 80% - consider cleanup or expansion',
    metric: 'disk_usage_percent' as any,
    condition: 'gt',
    threshold: 80,
    duration: 60,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'disk-usage-90percent',
    name: 'Critical Disk Usage (90%)',
    description: 'Disk usage exceeded 90% - immediate action required',
    metric: 'disk_usage_percent' as any,
    condition: 'gt',
    threshold: 90,
    duration: 30,
    severity: 'critical',
    enabled: true,
  },

  // 4. Database connections > 18 → Email alert
  {
    id: 'db-connections-18',
    name: 'High Database Connections (18)',
    description: 'Database connections exceeded 18 (pool size: 20)',
    metric: 'database_connections' as any,
    condition: 'gt',
    threshold: 18,
    duration: 60,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'db-connections-19',
    name: 'Critical Database Connections (19)',
    description: 'Database connections at 19 - pool exhaustion imminent',
    metric: 'database_connections' as any,
    condition: 'gte',
    threshold: 19,
    duration: 30,
    severity: 'critical',
    enabled: true,
  },

  // 5. Any service down → Immediate alert
  {
    id: 'database-down',
    name: 'Database Service Down',
    description: 'PostgreSQL database is not responding',
    metric: 'database_latency',
    condition: 'gt',
    threshold: 30000, // 30s timeout = effectively down
    duration: 10, // Immediate (10s grace period)
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'redis-down',
    name: 'Redis Service Down',
    description: 'Redis cache service is not responding',
    metric: 'redis_latency',
    condition: 'gt',
    threshold: 10000, // 10s timeout = effectively down
    duration: 10,
    severity: 'critical',
    enabled: true,
  },
  {
    id: 'nlp-service-down',
    name: 'NLP Service Down',
    description: 'NLP/Question generation service is not responding',
    metric: 'nlp_latency',
    condition: 'gt',
    threshold: 30000, // 30s timeout
    duration: 30,
    severity: 'critical',
    enabled: true,
  },

  // Memory alerts
  {
    id: 'memory-usage-80percent',
    name: 'High Memory Usage (80%)',
    description: 'Application memory usage exceeded 80%',
    metric: 'memory_usage_percent',
    condition: 'gt',
    threshold: 80,
    duration: 120,
    severity: 'warning',
    enabled: true,
  },
  {
    id: 'memory-usage-95percent',
    name: 'Critical Memory Usage (95%)',
    description: 'Application memory usage exceeded 95% - OOM risk',
    metric: 'memory_usage_percent',
    condition: 'gt',
    threshold: 95,
    duration: 30,
    severity: 'critical',
    enabled: true,
  },
];

// Alert notification templates
export const alertTemplates = {
  email: {
    subject: {
      info: '[INFO] PDF Quiz Generator Alert: {{ruleName}}',
      warning: '[WARNING] PDF Quiz Generator Alert: {{ruleName}}',
      critical: '[CRITICAL] PDF Quiz Generator Alert: {{ruleName}}',
    },
    body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .alert-box { padding: 20px; border-radius: 8px; margin: 20px 0; }
    .info { background: #e3f2fd; border-left: 4px solid #2196f3; }
    .warning { background: #fff3e0; border-left: 4px solid #ff9800; }
    .critical { background: #ffebee; border-left: 4px solid #f44336; }
    .metric { font-size: 24px; font-weight: bold; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <h2>🔔 Alert: {{ruleName}}</h2>
  
  <div class="alert-box {{severity}}">
    <p><strong>Severity:</strong> {{severity}}</p>
    <p><strong>Description:</strong> {{description}}</p>
    <p><strong>Metric:</strong> {{metric}}</p>
    <p class="metric">Current Value: {{currentValue}} (Threshold: {{threshold}})</p>
    <p><strong>Triggered At:</strong> {{triggeredAt}}</p>
  </div>
  
  <h3>Recommended Actions:</h3>
  <ul>
    <li>Check the monitoring dashboard for more details</li>
    <li>Review recent deployments or changes</li>
    <li>Check application and server logs</li>
    <li>Contact on-call engineer if critical</li>
  </ul>
  
  <div class="footer">
    <p>This is an automated alert from PDF Quiz Generator.</p>
    <p>Alert ID: {{alertId}} | Rule ID: {{ruleId}}</p>
    <p><a href="{{dashboardUrl}}">View Monitoring Dashboard</a></p>
  </div>
</body>
</html>
    `.trim(),
  },

  slack: {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔔 {{ruleName}}',
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Severity:*\n{{severity}}' },
          { type: 'mrkdwn', text: '*Metric:*\n{{metric}}' },
          { type: 'mrkdwn', text: '*Current Value:*\n{{currentValue}}' },
          { type: 'mrkdwn', text: '*Threshold:*\n{{threshold}}' },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '{{description}}',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Triggered at {{triggeredAt}} | Alert ID: {{alertId}}',
          },
        ],
      },
    ],
  },
};

// Cooldown periods to prevent alert fatigue
export const alertCooldowns = {
  info: 3600,      // 1 hour
  warning: 1800,   // 30 minutes
  critical: 300,   // 5 minutes
};

// Escalation configuration
export const escalationConfig = {
  enabled: process.env.ALERT_ESCALATION_ENABLED === 'true',
  levels: [
    {
      name: 'Level 1 - Development Team',
      waitMinutes: 0,
      recipients: (process.env.ALERT_L1_RECIPIENTS || '').split(',').filter(Boolean),
    },
    {
      name: 'Level 2 - Tech Lead',
      waitMinutes: 15,
      recipients: (process.env.ALERT_L2_RECIPIENTS || '').split(',').filter(Boolean),
    },
    {
      name: 'Level 3 - Engineering Manager',
      waitMinutes: 30,
      recipients: (process.env.ALERT_L3_RECIPIENTS || '').split(',').filter(Boolean),
    },
  ],
};

export default {
  emailConfig,
  alertRules,
  alertTemplates,
  alertCooldowns,
  escalationConfig,
};
