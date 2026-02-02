import { sql } from 'drizzle-orm';
import { Router, Request, Response } from 'express';

import { redis } from '../config/redis';
import { db } from '../db';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    nlp: ServiceStatus;
  };
  metrics: SystemMetrics;
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

interface SystemMetrics {
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    heapUsedPercent: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  requests: {
    total: number;
    success: number;
    error: number;
    errorRate: number;
  };
  responseTime: {
    avg: number;
    p50: number;
    p95: number;
    p99: number;
  };
}

// Request tracking for metrics
let requestMetrics = {
  total: 0,
  success: 0,
  error: 0,
  responseTimes: [] as number[],
};

// Reset metrics every hour
setInterval(
  () => {
    requestMetrics = {
      total: 0,
      success: 0,
      error: 0,
      responseTimes: [],
    };
  },
  60 * 60 * 1000
);

// Track request metrics
export const trackRequest = (statusCode: number, responseTime: number) => {
  requestMetrics.total++;
  if (statusCode < 400) {
    requestMetrics.success++;
  } else {
    requestMetrics.error++;
  }

  // Keep last 1000 response times for percentile calculations
  requestMetrics.responseTimes.push(responseTime);
  if (requestMetrics.responseTimes.length > 1000) {
    requestMetrics.responseTimes.shift();
  }
};

// Calculate percentile
const percentile = (arr: number[], p: number): number | undefined => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
};

// Check database health
async function checkDatabase(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

// Check Redis health
async function checkRedis(): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await redis.ping();
    return {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: error instanceof Error ? error.message : 'Redis connection failed',
    };
  }
}

// Check NLP service health
async function checkNlpService(): Promise<ServiceStatus> {
  const start = Date.now();
  const nlpUrl = process.env.NLP_SERVICE_URL || 'http://localhost:8000';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`${nlpUrl}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return {
        status: 'healthy',
        latency: Date.now() - start,
      };
    } else {
      return {
        status: 'unhealthy',
        latency: Date.now() - start,
        message: `NLP service returned ${response.status}`,
      };
    }
  } catch (error) {
    // NLP service is optional, so don't fail if it's down
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      message: 'NLP service offline (optional)',
    };
  }
}

// Get system metrics
function getSystemMetrics(): SystemMetrics {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();

  return {
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024),
      heapUsedPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
    cpu: {
      user: Math.round(cpuUsage.user / 1000),
      system: Math.round(cpuUsage.system / 1000),
    },
    requests: {
      total: requestMetrics.total,
      success: requestMetrics.success,
      error: requestMetrics.error,
      errorRate:
        requestMetrics.total > 0
          ? Math.round((requestMetrics.error / requestMetrics.total) * 10000) / 100
          : 0,
    },
    responseTime: {
      avg:
        requestMetrics.responseTimes.length > 0
          ? Math.round(
              requestMetrics.responseTimes.reduce((a, b) => a + b, 0) /
                requestMetrics.responseTimes.length
            )
          : 0,
      p50: percentile(requestMetrics.responseTimes, 50),
      p95: percentile(requestMetrics.responseTimes, 95),
      p99: percentile(requestMetrics.responseTimes, 99),
    },
  };
}

// Health check endpoint
router.get('/health', async (_req: Request, res: Response) => {
  const [database, redisStatus, nlp] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkNlpService(),
  ]);

  const anyUnhealthy = database.status === 'unhealthy' || redisStatus.status === 'unhealthy';

  const healthStatus: HealthStatus = {
    status: anyUnhealthy ? 'unhealthy' : nlp.status === 'unhealthy' ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      database,
      redis: redisStatus,
      nlp,
    },
    metrics: getSystemMetrics(),
  };

  const statusCode = healthStatus.status === 'unhealthy' ? 503 : 200;
  res.status(statusCode).json(healthStatus);
});

// Simple liveness probe (for k8s/load balancers)
router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness probe (checks dependencies)
router.get('/ready', async (_req: Request, res: Response) => {
  const [database, redisStatus] = await Promise.all([checkDatabase(), checkRedis()]);

  if (database.status === 'healthy' && redisStatus.status === 'healthy') {
    res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      issues: {
        database: database.status !== 'healthy' ? database.message : undefined,
        redis: redisStatus.status !== 'healthy' ? redisStatus.message : undefined,
      },
    });
  }
});

// Metrics endpoint (Prometheus format)
router.get('/metrics', async (_req: Request, res: Response) => {
  const metrics = getSystemMetrics();
  const uptime = process.uptime();

  const prometheusMetrics = `
# HELP pdfquiz_uptime_seconds Application uptime in seconds
# TYPE pdfquiz_uptime_seconds gauge
pdfquiz_uptime_seconds ${uptime}

# HELP pdfquiz_memory_heap_used_bytes Heap memory used
# TYPE pdfquiz_memory_heap_used_bytes gauge
pdfquiz_memory_heap_used_bytes ${metrics.memory.heapUsed * 1024 * 1024}

# HELP pdfquiz_memory_heap_total_bytes Heap memory total
# TYPE pdfquiz_memory_heap_total_bytes gauge
pdfquiz_memory_heap_total_bytes ${metrics.memory.heapTotal * 1024 * 1024}

# HELP pdfquiz_memory_rss_bytes RSS memory
# TYPE pdfquiz_memory_rss_bytes gauge
pdfquiz_memory_rss_bytes ${metrics.memory.rss * 1024 * 1024}

# HELP pdfquiz_requests_total Total number of requests
# TYPE pdfquiz_requests_total counter
pdfquiz_requests_total ${metrics.requests.total}

# HELP pdfquiz_requests_success_total Successful requests
# TYPE pdfquiz_requests_success_total counter
pdfquiz_requests_success_total ${metrics.requests.success}

# HELP pdfquiz_requests_error_total Failed requests
# TYPE pdfquiz_requests_error_total counter
pdfquiz_requests_error_total ${metrics.requests.error}

# HELP pdfquiz_request_duration_ms Request duration in milliseconds
# TYPE pdfquiz_request_duration_ms summary
pdfquiz_request_duration_ms{quantile="0.5"} ${metrics.responseTime.p50}
pdfquiz_request_duration_ms{quantile="0.95"} ${metrics.responseTime.p95}
pdfquiz_request_duration_ms{quantile="0.99"} ${metrics.responseTime.p99}
pdfquiz_request_duration_ms_avg ${metrics.responseTime.avg}
`.trim();

  res.set('Content-Type', 'text/plain');
  res.send(prometheusMetrics);
});

export { router as healthRoutes };
