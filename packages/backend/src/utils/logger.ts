/**
 * Winston logger configuration
 * Provides structured JSON logging with request tracing
 */
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

/**
 * Log levels in order of priority
 */
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Colors for console output
 */
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(logColors);

/**
 * Determine log level from environment
 */
const level = (): string => {
  const env = process.env.NODE_ENV || 'development';
  const configLevel = process.env.LOG_LEVEL;

  if (configLevel) return configLevel;
  return env === 'development' ? 'debug' : 'info';
};

/**
 * Custom format for structured logging
 */
const structuredFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Console format for development
 */
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

/**
 * Create transport based on environment
 */
const transports: winston.transport[] = [];

// Always add console transport
transports.push(
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? structuredFormat : consoleFormat,
  })
);

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logPath = process.env.LOG_FILE_PATH || './logs';

  transports.push(
    new winston.transports.File({
      filename: `${logPath}/error.log`,
      level: 'error',
      format: structuredFormat,
    }),
    new winston.transports.File({
      filename: `${logPath}/combined.log`,
      format: structuredFormat,
    })
  );
}

/**
 * Main logger instance
 */
export const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  defaultMeta: { service: 'pdf-quiz-backend' },
  transports,
});

/**
 * Request context storage for request ID tracking
 */
let currentRequestId: string | null = null;

/**
 * Set current request ID for logging context
 * @param requestId Request identifier
 */
export function setRequestId(requestId: string): void {
  currentRequestId = requestId;
}

/**
 * Get current request ID
 * @returns Current request ID or null
 */
export function getRequestId(): string | null {
  return currentRequestId;
}

/**
 * Generate a new request ID
 * @returns UUID v4 string
 */
export function generateRequestId(): string {
  return uuidv4();
}

/**
 * Clear current request ID
 */
export function clearRequestId(): void {
  currentRequestId = null;
}

/**
 * Create a child logger with request context
 * @param requestId Request identifier
 * @returns Child logger with request_id in metadata
 */
export function createRequestLogger(requestId: string): winston.Logger {
  return logger.child({ request_id: requestId });
}

/**
 * Log with request context automatically included
 */
export const logWithContext = {
  error: (message: string, meta?: Record<string, unknown>) => {
    logger.error(message, { ...meta, request_id: currentRequestId });
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    logger.warn(message, { ...meta, request_id: currentRequestId });
  },
  info: (message: string, meta?: Record<string, unknown>) => {
    logger.info(message, { ...meta, request_id: currentRequestId });
  },
  http: (message: string, meta?: Record<string, unknown>) => {
    logger.http(message, { ...meta, request_id: currentRequestId });
  },
  debug: (message: string, meta?: Record<string, unknown>) => {
    logger.debug(message, { ...meta, request_id: currentRequestId });
  },
};
