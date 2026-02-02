/**
 * Email Service
 *
 * Handles sending email notifications for alerts and system events.
 * Uses Nodemailer with configurable SMTP transport.
 */

import nodemailer from 'nodemailer';

import { emailConfig, alertTemplates } from '../config/alerts.config';
import logger from '../config/logger.config';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface AlertEmailData {
  alertId: string;
  ruleId: string;
  ruleName: string;
  description: string;
  metric: string;
  currentValue: number | string;
  threshold: number | string;
  severity: 'info' | 'warning' | 'critical';
  triggeredAt: string;
  dashboardUrl?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isEnabled: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!emailConfig.enabled) {
      logger.info('Email service disabled');
      return;
    }

    if (!emailConfig.smtp.auth.user || !emailConfig.smtp.auth.pass) {
      logger.warn('Email service disabled: SMTP credentials not configured');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.auth.user,
          pass: emailConfig.smtp.auth.pass,
        },
      });

      this.isEnabled = true;
      logger.info('Email service initialized', { host: emailConfig.smtp.host });
    } catch (error) {
      logger.error('Failed to initialize email service', { error });
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified');
      return true;
    } catch (error) {
      logger.error('SMTP connection verification failed', { error });
      return false;
    }
  }

  /**
   * Send a generic email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isEnabled || !this.transporter) {
      logger.warn('Email not sent: service disabled', { subject: options.subject });
      return false;
    }

    try {
      const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to;

      const info = await this.transporter.sendMail({
        from: emailConfig.from,
        to: recipients,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      logger.info('Email sent successfully', {
        messageId: info.messageId,
        to: recipients,
        subject: options.subject,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send email', {
        error,
        to: options.to,
        subject: options.subject,
      });
      return false;
    }
  }

  /**
   * Send an alert notification email
   */
  async sendAlertEmail(data: AlertEmailData): Promise<boolean> {
    const recipients = emailConfig.recipients;

    if (recipients.length === 0) {
      logger.warn('No email recipients configured for alerts');
      return false;
    }

    const subject = this.interpolateTemplate(alertTemplates.email.subject[data.severity], data);

    const html = this.interpolateTemplate(alertTemplates.email.body, {
      ...data,
      dashboardUrl:
        data.dashboardUrl || process.env.DASHBOARD_URL || 'https://pdfquizgen.com/monitoring',
    });

    return this.sendEmail({
      to: recipients,
      subject,
      html,
      text: this.htmlToText(html),
    });
  }

  /**
   * Send alert resolution email
   */
  async sendAlertResolvedEmail(
    data: Omit<AlertEmailData, 'currentValue'> & { resolvedAt: string }
  ): Promise<boolean> {
    const recipients = emailConfig.recipients;

    if (recipients.length === 0) {
      return false;
    }

    const subject = `[RESOLVED] PDF Quiz Generator Alert: ${data.ruleName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .resolved-box { padding: 20px; border-radius: 8px; margin: 20px 0; background: #e8f5e9; border-left: 4px solid #4caf50; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h2>✅ Alert Resolved: ${data.ruleName}</h2>
        
        <div class="resolved-box">
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Metric:</strong> ${data.metric}</p>
          <p><strong>Triggered At:</strong> ${data.triggeredAt}</p>
          <p><strong>Resolved At:</strong> ${data.resolvedAt}</p>
        </div>
        
        <div class="footer">
          <p>This is an automated notification from PDF Quiz Generator.</p>
          <p>Alert ID: ${data.alertId}</p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipients,
      subject,
      html,
      text: this.htmlToText(html),
    });
  }

  /**
   * Send daily summary email
   */
  async sendDailySummary(data: {
    date: string;
    totalRequests: number;
    errorCount: number;
    avgResponseTime: number;
    alertsTriggered: number;
    alertsResolved: number;
    uptimePercent: number;
  }): Promise<boolean> {
    const recipients = emailConfig.recipients;

    if (recipients.length === 0) {
      return false;
    }

    const subject = `[Daily Summary] PDF Quiz Generator - ${data.date}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .summary-box { padding: 20px; border-radius: 8px; margin: 20px 0; background: #f5f5f5; }
          .metric { display: inline-block; margin: 10px 20px 10px 0; text-align: center; }
          .metric-value { font-size: 24px; font-weight: bold; color: #1976d2; }
          .metric-label { font-size: 12px; color: #666; }
          .status-good { color: #4caf50; }
          .status-warn { color: #ff9800; }
          .status-bad { color: #f44336; }
          .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <h2>📊 Daily Summary - ${data.date}</h2>
        
        <div class="summary-box">
          <div class="metric">
            <div class="metric-value">${data.totalRequests.toLocaleString()}</div>
            <div class="metric-label">Total Requests</div>
          </div>
          
          <div class="metric">
            <div class="metric-value ${data.errorCount === 0 ? 'status-good' : 'status-warn'}">${data.errorCount}</div>
            <div class="metric-label">Errors</div>
          </div>
          
          <div class="metric">
            <div class="metric-value ${data.avgResponseTime < 500 ? 'status-good' : 'status-warn'}">${data.avgResponseTime}ms</div>
            <div class="metric-label">Avg Response Time</div>
          </div>
          
          <div class="metric">
            <div class="metric-value ${data.uptimePercent >= 99.5 ? 'status-good' : 'status-warn'}">${data.uptimePercent.toFixed(2)}%</div>
            <div class="metric-label">Uptime</div>
          </div>
        </div>
        
        <h3>Alert Activity</h3>
        <ul>
          <li>Alerts Triggered: ${data.alertsTriggered}</li>
          <li>Alerts Resolved: ${data.alertsResolved}</li>
        </ul>
        
        <div class="footer">
          <p>This is an automated daily summary from PDF Quiz Generator.</p>
          <p><a href="${process.env.DASHBOARD_URL || 'https://pdfquizgen.com/monitoring'}">View Full Dashboard</a></p>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: recipients,
      subject,
      html,
      text: this.htmlToText(html),
    });
  }

  /**
   * Interpolate template variables
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  /**
   * Convert HTML to plain text (basic)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
