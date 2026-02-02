/**
 * PM2 Ecosystem Configuration
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 start ecosystem.config.js --env production
 *   pm2 restart ecosystem.config.js
 *   pm2 reload ecosystem.config.js  (zero-downtime reload)
 *   pm2 stop ecosystem.config.js
 *   pm2 delete ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 */

const path = require('path');

const APPS_ROOT = process.env.APPS_ROOT || '/opt/apps/pdfquiz';
const LOGS_DIR = path.join(APPS_ROOT, 'logs');

module.exports = {
  apps: [
    // Backend API Server
    {
      name: 'pdfquiz-backend',
      cwd: path.join(APPS_ROOT, 'packages/backend'),
      script: 'dist/index.js',

      // Cluster mode for multi-core utilization
      instances: process.env.NODE_ENV === 'production' ? 'max' : 1,
      exec_mode: process.env.NODE_ENV === 'production' ? 'cluster' : 'fork',

      // Environment variables
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_staging: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },

      // Resource limits
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512',

      // Logging
      error_file: path.join(LOGS_DIR, 'backend-error.log'),
      out_file: path.join(LOGS_DIR, 'backend-out.log'),
      log_file: path.join(LOGS_DIR, 'backend-combined.log'),
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Behavior
      watch: false,
      ignore_watch: ['node_modules', 'logs', '.git'],
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 1000,

      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 8000,

      // Health check
      exp_backoff_restart_delay: 100,
    },

    // NLP Service (Python FastAPI)
    {
      name: 'pdfquiz-nlp',
      cwd: path.join(APPS_ROOT, 'packages/nlp-service'),
      script: 'start.sh',
      interpreter: '/bin/bash',

      // Single instance for Python
      instances: 1,
      exec_mode: 'fork',

      // Environment
      env: {
        PYTHONUNBUFFERED: '1',
        NLP_ENV: 'development',
        NLP_PORT: 8000,
      },
      env_production: {
        PYTHONUNBUFFERED: '1',
        NLP_ENV: 'production',
        NLP_PORT: 8000,
        NLP_WORKERS: 4,
      },

      // Resource limits
      max_memory_restart: '1G',

      // Logging
      error_file: path.join(LOGS_DIR, 'nlp-error.log'),
      out_file: path.join(LOGS_DIR, 'nlp-out.log'),
      log_file: path.join(LOGS_DIR, 'nlp-combined.log'),
      merge_logs: true,
      time: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Behavior
      watch: false,
      autorestart: true,
      max_restarts: 5,
      min_uptime: '30s',
      restart_delay: 5000,

      // Graceful shutdown
      kill_timeout: 10000,
    },

    // Scheduled Tasks (Optional - for cron-like jobs)
    {
      name: 'pdfquiz-scheduler',
      cwd: path.join(APPS_ROOT, 'packages/backend'),
      script: 'dist/scheduler.js',

      instances: 1,
      exec_mode: 'fork',
      cron_restart: '0 0 * * *', // Restart daily at midnight

      env_production: {
        NODE_ENV: 'production',
      },

      // Logging
      error_file: path.join(LOGS_DIR, 'scheduler-error.log'),
      out_file: path.join(LOGS_DIR, 'scheduler-out.log'),
      merge_logs: true,
      time: true,

      // Start disabled by default
      autorestart: false,
    },
  ],

  // Deployment configuration for PM2 deploy
  deploy: {
    production: {
      user: 'deploy',
      host: ['your-server.com'],
      ref: 'origin/main',
      repo: 'git@github.com:your-org/pdf-quiz-generator.git',
      path: APPS_ROOT,
      'pre-deploy-local': '',
      'post-deploy':
        'pnpm install && pnpm build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': '',
      env: {
        NODE_ENV: 'production',
      },
    },
    staging: {
      user: 'deploy',
      host: ['staging.your-server.com'],
      ref: 'origin/develop',
      repo: 'git@github.com:your-org/pdf-quiz-generator.git',
      path: '/opt/apps/pdfquiz-staging',
      'post-deploy': 'pnpm install && pnpm build && pm2 reload ecosystem.config.js --env staging',
      env: {
        NODE_ENV: 'staging',
      },
    },
  },
};
