# PDF Quiz Generator - Deployment Guide

This guide covers deploying the PDF Quiz Generator to production, with specific instructions for Mac Mini M4 deployment.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup](#infrastructure-setup)
3. [Application Deployment](#application-deployment)
4. [SSL/TLS Configuration](#ssltls-configuration)
5. [Process Management](#process-management)
6. [Database Backup](#database-backup)
7. [Monitoring](#monitoring)
8. [Scaling](#scaling)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Hardware Requirements (Mac Mini M4)

| Component | Minimum    | Recommended |
| --------- | ---------- | ----------- |
| RAM       | 8 GB       | 16+ GB      |
| Storage   | 256 GB SSD | 512+ GB SSD |
| Network   | 100 Mbps   | 1 Gbps      |

### Software Requirements

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required packages
brew install node@20 pnpm postgresql@15 redis nginx python@3.11

# Install PM2 globally
npm install -g pm2

# Install certbot for SSL
brew install certbot
```

---

## Infrastructure Setup

### PostgreSQL Setup

```bash
# Start PostgreSQL service
brew services start postgresql@15

# Create database and user
psql postgres << EOF
CREATE USER pdfquiz WITH PASSWORD 'your_secure_password';
CREATE DATABASE pdfquiz_prod OWNER pdfquiz;
GRANT ALL PRIVILEGES ON DATABASE pdfquiz_prod TO pdfquiz;
EOF

# Configure PostgreSQL for production
# Edit /opt/homebrew/var/postgresql@15/postgresql.conf
# max_connections = 100
# shared_buffers = 256MB
# effective_cache_size = 768MB
# maintenance_work_mem = 128MB
# checkpoint_completion_target = 0.9
# wal_buffers = 16MB
# default_statistics_target = 100
# random_page_cost = 1.1
# effective_io_concurrency = 200
```

### Redis Setup

```bash
# Start Redis service
brew services start redis

# Configure Redis for production
# Edit /opt/homebrew/etc/redis.conf
# maxmemory 256mb
# maxmemory-policy allkeys-lru
# appendonly yes
# appendfsync everysec
```

### Nginx Setup

Create `/opt/homebrew/etc/nginx/servers/pdfquiz.conf`:

```nginx
# Upstream definitions
upstream backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

upstream nlp_service {
    server 127.0.0.1:8000;
    keepalive 16;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=upload_limit:10m rate=1r/s;
limit_conn_zone $binary_remote_addr zone=conn_limit:10m;

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name your-domain.com www.your-domain.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/your-domain.com/chain.pem;

    # SSL configuration
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Connection limits
    limit_conn conn_limit 20;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Static files (frontend)
    root /opt/apps/pdfquiz/packages/frontend/dist;
    index index.html;

    # Frontend routing
    location / {
        try_files $uri $uri/ /index.html;

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API proxy
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # PDF upload endpoint (stricter limits)
    location /api/v1/pdfs {
        limit_req zone=upload_limit burst=5 nodelay;
        client_max_body_size 50M;

        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Longer timeout for uploads
        proxy_connect_timeout 120s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # NLP service proxy (internal only)
    location /nlp/ {
        internal;
        proxy_pass http://nlp_service/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://backend/api/v1/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;

        access_log off;
    }

    # Error pages
    error_page 500 502 503 504 /50x.html;
    location = /50x.html {
        root /opt/homebrew/share/nginx/html;
    }
}
```

Test and reload Nginx:

```bash
sudo nginx -t
sudo nginx -s reload
```

---

## Application Deployment

### Clone and Build

```bash
# Create application directory
sudo mkdir -p /opt/apps
sudo chown $(whoami) /opt/apps
cd /opt/apps

# Clone repository
git clone https://github.com/your-org/pdf-quiz-generator.git pdfquiz
cd pdfquiz

# Install dependencies
pnpm install --frozen-lockfile

# Build all packages
pnpm build
```

### Environment Configuration

Create `/opt/apps/pdfquiz/.env`:

```bash
# Node environment
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://pdfquiz:your_secure_password@localhost:5432/pdfquiz_prod
DATABASE_POOL_SIZE=20

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# JWT (Generate secure keys!)
JWT_ACCESS_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# NLP Service
NLP_SERVICE_URL=http://localhost:8000
OPENAI_API_KEY=your_openai_api_key

# File Storage
UPLOAD_DIR=/opt/apps/pdfquiz/uploads
MAX_FILE_SIZE=52428800

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Frontend URL (for CORS)
FRONTEND_URL=https://your-domain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Run Migrations

```bash
cd /opt/apps/pdfquiz
pnpm --filter @project-z/backend db:migrate
```

---

## SSL/TLS Configuration

### Obtain SSL Certificate

```bash
# Stop nginx temporarily
sudo nginx -s stop

# Get certificate
sudo certbot certonly --standalone \
  -d your-domain.com \
  -d www.your-domain.com \
  --email admin@your-domain.com \
  --agree-tos \
  --no-eff-email

# Start nginx
sudo nginx
```

### Auto-Renewal

Add to crontab (`crontab -e`):

```bash
0 0 1 * * certbot renew --quiet && nginx -s reload
```

---

## Process Management

### PM2 Ecosystem Configuration

Create `/opt/apps/pdfquiz/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'pdfquiz-backend',
      cwd: '/opt/apps/pdfquiz/packages/backend',
      script: 'dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '500M',
      error_file: '/opt/apps/pdfquiz/logs/backend-error.log',
      out_file: '/opt/apps/pdfquiz/logs/backend-out.log',
      merge_logs: true,
      time: true,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 1000,
    },
    {
      name: 'pdfquiz-nlp',
      cwd: '/opt/apps/pdfquiz/packages/nlp-service',
      script: 'run.sh',
      interpreter: 'bash',
      instances: 1,
      env: {
        PYTHONUNBUFFERED: '1',
      },
      max_memory_restart: '1G',
      error_file: '/opt/apps/pdfquiz/logs/nlp-error.log',
      out_file: '/opt/apps/pdfquiz/logs/nlp-out.log',
      merge_logs: true,
      time: true,
      autorestart: true,
    },
  ],
};
```

Create `/opt/apps/pdfquiz/packages/nlp-service/run.sh`:

```bash
#!/bin/bash
cd /opt/apps/pdfquiz/packages/nlp-service
source venv/bin/activate
exec uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
```

### Start Services

```bash
# Create logs directory
mkdir -p /opt/apps/pdfquiz/logs

# Start all services
cd /opt/apps/pdfquiz
pm2 start ecosystem.config.js

# Save PM2 process list
pm2 save

# Setup PM2 startup script
pm2 startup
# Run the command it outputs

# Monitor services
pm2 monit
```

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs

# Restart services
pm2 restart all

# Reload without downtime
pm2 reload pdfquiz-backend

# Stop services
pm2 stop all
```

---

## Database Backup

### Automated Backup Script

Create `/opt/apps/pdfquiz/scripts/backup-db.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/opt/apps/pdfquiz/backups"
DB_NAME="pdfquiz_prod"
DB_USER="pdfquiz"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pdfquiz_${DATE}.sql.gz"

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Create backup
echo "Starting backup at $(date)"
pg_dump -U ${DB_USER} ${DB_NAME} | gzip > ${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo "Backup successful: ${BACKUP_FILE}"
    echo "Size: $(du -h ${BACKUP_FILE} | cut -f1)"
else
    echo "Backup failed!"
    exit 1
fi

# Delete old backups
echo "Removing backups older than ${RETENTION_DAYS} days"
find ${BACKUP_DIR} -name "pdfquiz_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# List remaining backups
echo "Current backups:"
ls -lh ${BACKUP_DIR}/*.sql.gz 2>/dev/null || echo "No backups found"

echo "Backup completed at $(date)"
```

Make executable and add to cron:

```bash
chmod +x /opt/apps/pdfquiz/scripts/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /opt/apps/pdfquiz/scripts/backup-db.sh >> /opt/apps/pdfquiz/logs/backup.log 2>&1
```

### Restore from Backup

```bash
# Restore from backup
gunzip -c /opt/apps/pdfquiz/backups/pdfquiz_YYYYMMDD_HHMMSS.sql.gz | psql -U pdfquiz pdfquiz_prod
```

---

## Monitoring

### Health Check Endpoint

The API provides a health check at `/api/v1/health`:

```bash
curl https://your-domain.com/api/v1/health
```

### PM2 Monitoring

```bash
# Web-based dashboard
pm2 plus

# Or use pm2-logrotate for log management
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Resource Monitoring

Create `/opt/apps/pdfquiz/scripts/monitor.sh`:

```bash
#!/bin/bash

echo "=== System Resources ==="
echo "CPU: $(top -l 1 | grep "CPU usage" | awk '{print $3}')"
echo "Memory: $(vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+free[^\d]+(\d+)/ and printf("Free: %.2f GB\n", $1*$size/1073741824);')"
echo "Disk: $(df -h / | tail -1 | awk '{print $4 " available"}')"

echo ""
echo "=== Service Status ==="
pm2 jlist | jq -r '.[] | "\(.name): \(.pm2_env.status) (memory: \(.monit.memory / 1024 / 1024 | floor)MB, cpu: \(.monit.cpu)%)"'

echo ""
echo "=== Database Connections ==="
psql -U pdfquiz -d pdfquiz_prod -c "SELECT count(*) as connections FROM pg_stat_activity WHERE datname = 'pdfquiz_prod';"

echo ""
echo "=== Redis Info ==="
redis-cli INFO | grep -E "connected_clients|used_memory_human|keyspace"
```

### Alerting

Create a simple alert script `/opt/apps/pdfquiz/scripts/alert.sh`:

```bash
#!/bin/bash

# Check if backend is running
if ! pm2 jlist | jq -e '.[] | select(.name == "pdfquiz-backend" and .pm2_env.status == "online")' > /dev/null; then
    echo "ALERT: Backend is not running!" | mail -s "PDF Quiz Alert" admin@your-domain.com
fi

# Check disk space (alert if < 10%)
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | tr -d '%')
if [ $DISK_USAGE -gt 90 ]; then
    echo "ALERT: Disk usage at ${DISK_USAGE}%" | mail -s "PDF Quiz Alert" admin@your-domain.com
fi

# Check API health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/v1/health)
if [ $HTTP_CODE -ne 200 ]; then
    echo "ALERT: Health check failed with code ${HTTP_CODE}" | mail -s "PDF Quiz Alert" admin@your-domain.com
fi
```

---

## Scaling

### Horizontal Scaling (Multiple Mac Minis)

For high availability, deploy behind a load balancer:

1. Set up multiple Mac Mini servers
2. Use external PostgreSQL (e.g., AWS RDS)
3. Use external Redis (e.g., AWS ElastiCache)
4. Configure load balancer (e.g., AWS ALB, Cloudflare)

### Vertical Scaling

Adjust PM2 instances based on CPU cores:

```javascript
// ecosystem.config.js
{
  instances: 8,  // Match CPU cores
  max_memory_restart: '1G',
}
```

---

## Troubleshooting

### Common Issues

#### Backend won't start

```bash
# Check logs
pm2 logs pdfquiz-backend --lines 100

# Check port availability
lsof -i :3000

# Verify environment
cat /opt/apps/pdfquiz/.env
```

#### Database connection errors

```bash
# Test connection
psql -U pdfquiz -d pdfquiz_prod -c "SELECT 1;"

# Check PostgreSQL status
brew services list | grep postgresql

# View PostgreSQL logs
tail -100 /opt/homebrew/var/log/postgresql@15.log
```

#### SSL certificate issues

```bash
# Test certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiry
echo | openssl s_client -servername your-domain.com -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates

# Renew certificate manually
sudo certbot renew --force-renewal
```

#### High memory usage

```bash
# Find memory-heavy processes
ps aux --sort=-%mem | head -20

# Restart services to free memory
pm2 restart all
```

### Logs Location

| Service     | Log Location                              |
| ----------- | ----------------------------------------- |
| Backend     | `/opt/apps/pdfquiz/logs/backend-*.log`    |
| NLP Service | `/opt/apps/pdfquiz/logs/nlp-*.log`        |
| Nginx       | `/opt/homebrew/var/log/nginx/`            |
| PostgreSQL  | `/opt/homebrew/var/log/postgresql@15.log` |
| Backup      | `/opt/apps/pdfquiz/logs/backup.log`       |

---

## Deployment Checklist

- [ ] Hardware meets requirements
- [ ] All software dependencies installed
- [ ] PostgreSQL configured and secured
- [ ] Redis configured
- [ ] SSL certificates obtained
- [ ] Nginx configured with SSL
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] PM2 ecosystem configured
- [ ] Services started and healthy
- [ ] Backup script scheduled
- [ ] Monitoring scripts in place
- [ ] Firewall configured (if applicable)
- [ ] DNS records updated
- [ ] Health checks passing

---

_Deployment guide last updated: January 2025_
