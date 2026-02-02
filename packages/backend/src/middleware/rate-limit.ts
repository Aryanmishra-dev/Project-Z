/**
 * Rate limiting middleware
 * Implements rate limiting with Redis storage for distributed environments
 */
import { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

import { redis, buildRedisKey, REDIS_KEYS } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Rate limit configuration
 */
interface RateLimitConfig {
  /** Window size in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Whether to skip successful requests in count */
  skipSuccessfulRequests?: boolean;
  /** Custom key generator */
  keyGenerator?: (req: Request) => string;
}

/**
 * Custom Redis store for rate limiting
 */
class RedisStore {
  private prefix: string;
  private windowMs: number;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  /**
   * Increment hit count for a key
   */
  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    try {
      const redisKey = buildRedisKey(this.prefix, key);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      // Use a sorted set to track request timestamps
      const pipeline = redis.pipeline();

      // Remove old entries outside the window
      pipeline.zremrangebyscore(redisKey, '-inf', windowStart);

      // Add current timestamp
      pipeline.zadd(redisKey, now, `${now}-${Math.random()}`);

      // Count entries in window
      pipeline.zcard(redisKey);

      // Set expiry on the key
      pipeline.pexpire(redisKey, this.windowMs);

      const results = (await Promise.race([
        pipeline.exec(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000)),
      ])) as any;

      // Get count from results (index 2 is zcard result)
      const totalHits = (results?.[2]?.[1] as number) || 0;
      const resetTime = new Date(now + this.windowMs);

      return { totalHits, resetTime };
    } catch (error) {
      logger.warn('Rate limit Redis error, allowing request', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      // On error, allow the request (fail open)
      return { totalHits: 0, resetTime: new Date(Date.now() + this.windowMs) };
    }
  }

  /**
   * Decrement hit count (for successful requests if configured)
   */
  async decrement(key: string): Promise<void> {
    const redisKey = buildRedisKey(this.prefix, key);
    const members = await redis.zrange(redisKey, -1, -1);
    if (members.length > 0) {
      await redis.zrem(redisKey, members[0]);
    }
  }

  /**
   * Reset hit count for a key
   */
  async resetKey(key: string): Promise<void> {
    const redisKey = buildRedisKey(this.prefix, key);
    await redis.del(redisKey);
  }
}

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 */
function getClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0];
    return ips?.trim() || 'unknown';
  }

  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Create rate limiter with custom configuration
 */
function createRateLimiter(config: RateLimitConfig, name: string) {
  const store = new RedisStore(buildRedisKey(REDIS_KEYS.RATE_LIMIT, name), config.windowMs);

  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true, // Return rate limit info in headers
    legacyHeaders: false, // Disable X-RateLimit headers
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    keyGenerator: config.keyGenerator || ((req) => getClientIp(req)),
    handler: (_req: Request, res: Response) => {
      const retryAfter = Math.ceil(config.windowMs / 1000);

      logger.warn('Rate limit exceeded', {
        ip: getClientIp(_req),
        path: _req.path,
        retryAfter,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests, retry after ${retryAfter} seconds`,
          retryAfter,
        },
      });
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/api/v1/health';
    },
    // Use custom store for increment/decrement
    store: {
      init: () => {},
      increment: async (key: string) => store.increment(key),
      decrement: async (key: string) => store.decrement(key),
      resetKey: async (key: string) => store.resetKey(key),
    } as any,
  });
}

/**
 * Rate limiter for authentication endpoints
 * 5 requests per 15 minutes
 */
export const authRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skipSuccessfulRequests: false,
  },
  'auth'
);

/**
 * Rate limiter for general API endpoints
 * 1000 requests per 15 minutes
 */
export const apiRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,
    skipSuccessfulRequests: false,
  },
  'api'
);

/**
 * Rate limiter for login attempts specifically
 * 5 attempts per 15 minutes per IP + email combination
 */
export const loginRateLimiter = createRateLimiter(
  {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    skipSuccessfulRequests: true, // Don't count successful logins
    keyGenerator: (req) => {
      const ip = getClientIp(req);
      const email = (req.body?.email || '').toLowerCase();
      return `${ip}:${email}`;
    },
  },
  'login'
);

/**
 * Strict rate limiter for sensitive operations
 * 3 requests per minute
 */
export const strictRateLimiter = createRateLimiter(
  {
    windowMs: 60 * 1000, // 1 minute
    max: 3,
  },
  'strict'
);
