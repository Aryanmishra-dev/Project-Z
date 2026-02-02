/**
 * Security Middleware Configuration
 * Implements security headers, CORS, and protection measures
 */
import cors from 'cors';
import type { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';

import { logger } from '../utils/logger';

/**
 * Content Security Policy configuration
 */
const cspDirectives = {
  defaultSrc: ["'self'"] as const,
  scriptSrc: ["'self'"] as const,
  styleSrc: ["'self'", "'unsafe-inline'"] as const, // Required for inline styles
  imgSrc: ["'self'", 'data:', 'blob:'] as const,
  fontSrc: ["'self'"] as const,
  connectSrc: ["'self'", 'ws://localhost:*', 'wss://localhost:*'] as const,
  frameAncestors: ["'none'"] as const,
  objectSrc: ["'none'"] as const,
  mediaSrc: ["'self'"] as const,
  workerSrc: ["'self'", 'blob:'] as const,
  childSrc: ["'self'"] as const,
  formAction: ["'self'"] as const,
};

/**
 * Helmet security headers configuration
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: cspDirectives,
  },
  crossOriginEmbedderPolicy: false, // May need to be false for some resources
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true,
});

/**
 * CORS configuration
 */
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:3000',
];

export const corsConfig = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origin
    logger.warn('Blocked request from unauthorized origin', { origin });
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Request-ID',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204,
});

/**
 * Additional security headers not covered by Helmet
 */
export function additionalSecurityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Permissions Policy (formerly Feature Policy)
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'usb=()',
      'bluetooth=()',
      'accelerometer=()',
      'gyroscope=()',
      'magnetometer=()',
      'ambient-light-sensor=()',
    ].join(', ')
  );

  // Prevent caching of sensitive data
  if (req.path.includes('/auth') || req.path.includes('/users')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  // Clear sensitive headers
  res.removeHeader('X-Powered-By');

  next();
}

/**
 * Request sanitization middleware
 */
export function sanitizeRequest(req: Request, _res: Response, next: NextFunction): void {
  // Sanitize common injection patterns from all string inputs
  const sanitize = (obj: Record<string, unknown>): void => {
    for (const key in obj) {
      const value = obj[key];
      if (typeof value === 'string') {
        // Remove null bytes
        obj[key] = value.replace(/\0/g, '');
        // Remove common XSS patterns (basic protection, use DOMPurify for HTML)
        obj[key] = (obj[key] as string).replace(
          /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
          ''
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitize(value as Record<string, unknown>);
      }
    }
  };

  if (req.body && typeof req.body === 'object') {
    sanitize(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    sanitize(req.query as Record<string, unknown>);
  }
  if (req.params && typeof req.params === 'object') {
    sanitize(req.params as Record<string, unknown>);
  }

  next();
}

/**
 * SQL Injection detection middleware (additional layer)
 */
export function detectSqlInjection(req: Request, res: Response, next: NextFunction): void {
  const sqlPatterns = [
    /(%27)|(')|(--|%23)|(#)/i,
    /((%3D)|(=))[^\n]*((%27)|(')|(--|%3B)|(;))/i,
    /\w*((%27)|(')|(%6F)|o|(%4F))((%72)|r|(%52))/i,
    /((%27)|("))union/i,
    /exec(\s|\+)+(s|x)p\w+/i,
  ];

  const checkForSqlInjection = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    return sqlPatterns.some((pattern) => pattern.test(value));
  };

  const checkObject = (obj: Record<string, unknown>): boolean => {
    for (const key in obj) {
      const value = obj[key];
      if (checkForSqlInjection(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (checkObject(value as Record<string, unknown>)) {
          return true;
        }
      }
    }
    return false;
  };

  if (
    (req.body && checkObject(req.body)) ||
    (req.query && checkObject(req.query as Record<string, unknown>)) ||
    (req.params && checkObject(req.params))
  ) {
    logger.warn('Potential SQL injection detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(400).json({
      status: 'error',
      message: 'Invalid characters in request',
    });
    return;
  }

  next();
}

/**
 * XSS detection middleware (additional layer)
 */
export function detectXss(req: Request, res: Response, next: NextFunction): void {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
  ];

  const checkForXss = (value: unknown): boolean => {
    if (typeof value !== 'string') return false;
    return xssPatterns.some((pattern) => pattern.test(value));
  };

  const checkObject = (obj: Record<string, unknown>): boolean => {
    for (const key in obj) {
      const value = obj[key];
      if (checkForXss(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (checkObject(value as Record<string, unknown>)) {
          return true;
        }
      }
    }
    return false;
  };

  if (
    (req.body && checkObject(req.body)) ||
    (req.query && checkObject(req.query as Record<string, unknown>))
  ) {
    logger.warn('Potential XSS attack detected', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    res.status(400).json({
      status: 'error',
      message: 'Invalid characters in request',
    });
    return;
  }

  next();
}

/**
 * Apply all security middleware to Express app
 */
export function applySecurityMiddleware(app: Express): void {
  // Helmet security headers
  app.use(helmetConfig);

  // CORS
  app.use(corsConfig);

  // Additional headers
  app.use(additionalSecurityHeaders);

  // Request sanitization
  app.use(sanitizeRequest);

  // SQL Injection detection
  app.use(detectSqlInjection);

  // XSS detection
  app.use(detectXss);

  // Trust proxy for rate limiting (if behind reverse proxy)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  logger.info('Security middleware applied');
}

export default {
  helmetConfig,
  corsConfig,
  additionalSecurityHeaders,
  sanitizeRequest,
  detectSqlInjection,
  detectXss,
  applySecurityMiddleware,
};
