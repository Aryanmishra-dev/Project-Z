/**
 * Logging Configuration
 *
 * Centralized logging with rotation, compression, and structured output.
 * - All logs stored in `logs/` directory
 * - Daily rotation, 30-day retention
 * - Automatic compression of old logs
 * - Separate streams for different log levels
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs');

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Human-readable format for console
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Daily rotate file transport options
const dailyRotateOptions = {
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '30d',
  zippedArchive: true, // Compress old logs
  dirname: LOG_DIR,
};

// Create transports
const transports: winston.transport[] = [
  // Console output (development)
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: consoleFormat,
  }),

  // Combined log - all levels
  new DailyRotateFile({
    ...dailyRotateOptions,
    filename: 'combined-%DATE%.log',
    level: 'info',
    format: structuredFormat,
  }),

  // Error log - errors only
  new DailyRotateFile({
    ...dailyRotateOptions,
    filename: 'error-%DATE%.log',
    level: 'error',
    format: structuredFormat,
  }),

  // Access log - HTTP requests
  new DailyRotateFile({
    ...dailyRotateOptions,
    filename: 'access-%DATE%.log',
    level: 'http',
    format: structuredFormat,
  }),

  // Debug log - verbose debugging (development only)
  ...(process.env.NODE_ENV !== 'production'
    ? [
        new DailyRotateFile({
          ...dailyRotateOptions,
          filename: 'debug-%DATE%.log',
          level: 'debug',
          format: structuredFormat,
        }),
      ]
    : []),
];

// Create the logger
const logger = winston.createLogger({
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'exceptions-%DATE%.log',
      format: structuredFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'rejections-%DATE%.log',
      format: structuredFormat,
    }),
  ],
});

// Add custom colors
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'cyan',
  debug: 'gray',
});

// Request logging middleware
export const requestLogger = (req: any, res: any, next: () => void) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id,
    };

    // Log errors at error level
    if (res.statusCode >= 500) {
      logger.error('Request error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('Request warning', logData);
    } else {
      logger.http('Request completed', logData);
    }
  });

  next();
};

// Structured logging helpers
export const logError = (message: string, error: Error, context?: Record<string, any>) => {
  logger.error(message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
};

export const logInfo = (message: string, context?: Record<string, any>) => {
  logger.info(message, context);
};

export const logWarn = (message: string, context?: Record<string, any>) => {
  logger.warn(message, context);
};

export const logDebug = (message: string, context?: Record<string, any>) => {
  logger.debug(message, context);
};

// Log audit events (user actions)
export const logAudit = (action: string, userId: string, details?: Record<string, any>) => {
  logger.info('Audit event', {
    type: 'audit',
    action,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Log security events
export const logSecurity = (
  event: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details?: Record<string, any>
) => {
  const logLevel = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
  logger[logLevel]('Security event', {
    type: 'security',
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Log performance metrics
export const logPerformance = (
  operation: string,
  durationMs: number,
  details?: Record<string, any>
) => {
  const level = durationMs > 1000 ? 'warn' : 'debug';
  logger[level]('Performance metric', {
    type: 'performance',
    operation,
    durationMs,
    slow: durationMs > 1000,
    ...details,
  });
};

// Monitor error logs for critical issues
export const setupErrorLogMonitoring = (
  onCriticalError: (message: string, details: any) => void
) => {
  const errorPatterns = [
    /database connection failed/i,
    /redis connection failed/i,
    /out of memory/i,
    /ENOSPC/i, // No space left on device
    /ENOMEM/i, // Out of memory
    /FATAL/i,
    /SIGTERM/i,
    /SIGKILL/i,
  ];

  // Hook into error logs
  logger.on('data', (info) => {
    if (info.level === 'error') {
      const message = info.message || '';
      const isCritical = errorPatterns.some((pattern) => pattern.test(message));

      if (isCritical) {
        onCriticalError(message, info);
      }
    }
  });
};

export default logger;
