/**
 * Monitoring Middleware
 * 
 * Tracks request metrics for monitoring and alerting.
 */

import { Request, Response, NextFunction } from 'express';
import { trackRequest } from '../routes/health.routes';
import { alertingService } from '../services/alerting.service';

interface RequestMetrics {
  startTime: number;
  method: string;
  path: string;
  statusCode?: number;
  responseTime?: number;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      metrics?: RequestMetrics;
    }
  }
}

// In-memory metrics storage
const metricsStore = {
  requestCount: 0,
  errorCount: 0,
  responseTimes: [] as number[],
  errorRate: 0,
  
  // Rolling window calculation
  recentRequests: [] as { timestamp: number; success: boolean; responseTime: number }[],
};

// Calculate metrics over last N minutes
const calculateRollingMetrics = (windowMinutes = 5) => {
  const cutoff = Date.now() - windowMinutes * 60 * 1000;
  const recentRequests = metricsStore.recentRequests.filter(r => r.timestamp > cutoff);
  
  if (recentRequests.length === 0) {
    return {
      errorRate: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      requestCount: 0,
    };
  }
  
  const errors = recentRequests.filter(r => !r.success).length;
  const responseTimes = recentRequests.map(r => r.responseTime).sort((a, b) => a - b);
  
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };
  
  return {
    errorRate: (errors / recentRequests.length) * 100,
    avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
    p50ResponseTime: percentile(responseTimes, 50),
    p95ResponseTime: percentile(responseTimes, 95),
    p99ResponseTime: percentile(responseTimes, 99),
    requestCount: recentRequests.length,
  };
};

// Cleanup old metrics periodically
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000; // Keep 10 minutes of data
  metricsStore.recentRequests = metricsStore.recentRequests.filter(r => r.timestamp > cutoff);
}, 60 * 1000);

// Update alerting service with current metrics
setInterval(() => {
  const metrics = calculateRollingMetrics();
  const memUsage = process.memoryUsage();
  const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
  
  alertingService.recordMetric('error_rate', metrics.errorRate);
  alertingService.recordMetric('response_time_p95', metrics.p95ResponseTime);
  alertingService.recordMetric('response_time_p99', metrics.p99ResponseTime);
  alertingService.recordMetric('memory_usage_percent', memPercent);
  alertingService.recordMetric('request_count', metrics.requestCount);
}, 10 * 1000);

/**
 * Request monitoring middleware
 */
export const monitoringMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Skip health check endpoints
  if (req.path === '/health' || req.path === '/live' || req.path === '/ready' || req.path === '/metrics') {
    return next();
  }
  
  const startTime = process.hrtime();
  
  req.metrics = {
    startTime: Date.now(),
    method: req.method,
    path: req.path,
  };
  
  // Intercept response finish
  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const responseTime = Math.round(seconds * 1000 + nanoseconds / 1000000);
    
    metricsStore.requestCount++;
    
    const success = res.statusCode < 400;
    if (!success) {
      metricsStore.errorCount++;
    }
    
    // Store in rolling window
    metricsStore.recentRequests.push({
      timestamp: Date.now(),
      success,
      responseTime,
    });
    
    // Track request for health endpoint
    trackRequest(res.statusCode, responseTime);
    
    // Log slow requests
    if (responseTime > 1000) {
      console.warn(`[Monitoring] Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
    }
    
    // Log errors
    if (res.statusCode >= 500) {
      console.error(`[Monitoring] Server error: ${req.method} ${req.path} - ${res.statusCode}`);
    }
  });
  
  next();
};

/**
 * Get current metrics summary
 */
export const getMetricsSummary = () => {
  const rolling = calculateRollingMetrics();
  const memUsage = process.memoryUsage();
  
  return {
    uptime: process.uptime(),
    requests: {
      total: metricsStore.requestCount,
      errors: metricsStore.errorCount,
      recent: rolling.requestCount,
      errorRate: rolling.errorRate,
    },
    responseTime: {
      avg: rolling.avgResponseTime,
      p50: rolling.p50ResponseTime,
      p95: rolling.p95ResponseTime,
      p99: rolling.p99ResponseTime,
    },
    memory: {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedPercent: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
    },
  };
};

/**
 * Request logging middleware (optional, for debugging)
 */
export const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  
  res.on('finish', () => {
    const duration = req.metrics ? Date.now() - req.metrics.startTime : 0;
    console.log(
      `[${timestamp}] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`
    );
  });
  
  next();
};

export default monitoringMiddleware;
