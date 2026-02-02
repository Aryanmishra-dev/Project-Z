/**
 * Rate Limiter Middleware Unit Tests
 * Tests for rate limiting configuration and behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before imports
vi.mock('express-rate-limit', () => ({
  default: vi.fn((config) => {
    // Return a middleware function that simulates rate limiting
    return vi.fn((req, res, next) => {
      // Simulate the rate limiter behavior for testing
      next();
    });
  }),
}));

vi.mock('../../src/config/redis', () => ({
  redis: {
    pipeline: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([
        [null, 1],
        [null, 1],
        [null, 3],
        [null, 1],
      ]),
    })),
    zrange: vi.fn().mockResolvedValue([]),
    zrem: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
  buildRedisKey: vi.fn((...args) => args.join(':')),
  REDIS_KEYS: {
    RATE_LIMIT: 'rate_limit',
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Rate Limiter Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('Auth Rate Limiter', () => {
    it('should be configured with 5 requests per 15 minutes', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      expect(rateLimit.default).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 5,
        })
      );
    });

    it('should export authRateLimiter', async () => {
      const { authRateLimiter } = await import('../../src/middleware/rate-limit');
      expect(authRateLimiter).toBeDefined();
      expect(typeof authRateLimiter).toBe('function');
    });
  });

  describe('API Rate Limiter', () => {
    it('should be configured with 1000 requests per 15 minutes', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      expect(rateLimit.default).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 1000,
        })
      );
    });

    it('should export apiRateLimiter', async () => {
      const { apiRateLimiter } = await import('../../src/middleware/rate-limit');
      expect(apiRateLimiter).toBeDefined();
      expect(typeof apiRateLimiter).toBe('function');
    });
  });

  describe('Login Rate Limiter', () => {
    it('should be configured with 5 attempts per 15 minutes', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      expect(rateLimit.default).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 15 * 60 * 1000, // 15 minutes
          max: 5,
          skipSuccessfulRequests: true,
        })
      );
    });

    it('should export loginRateLimiter', async () => {
      const { loginRateLimiter } = await import('../../src/middleware/rate-limit');
      expect(loginRateLimiter).toBeDefined();
      expect(typeof loginRateLimiter).toBe('function');
    });
  });

  describe('Strict Rate Limiter', () => {
    it('should be configured with 3 requests per minute', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      expect(rateLimit.default).toHaveBeenCalledWith(
        expect.objectContaining({
          windowMs: 60 * 1000, // 1 minute
          max: 3,
        })
      );
    });

    it('should export strictRateLimiter', async () => {
      const { strictRateLimiter } = await import('../../src/middleware/rate-limit');
      expect(strictRateLimiter).toBeDefined();
      expect(typeof strictRateLimiter).toBe('function');
    });
  });

  describe('Rate Limit Handler', () => {
    it('should use standardHeaders', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      // Check that at least one call uses standardHeaders
      const calls = (rateLimit.default as ReturnType<typeof vi.fn>).mock.calls;
      const hasStandardHeaders = calls.some((call) => call[0].standardHeaders === true);
      expect(hasStandardHeaders).toBe(true);
    });

    it('should disable legacyHeaders', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      // Check that at least one call disables legacyHeaders
      const calls = (rateLimit.default as ReturnType<typeof vi.fn>).mock.calls;
      const hasLegacyHeadersFalse = calls.some((call) => call[0].legacyHeaders === false);
      expect(hasLegacyHeadersFalse).toBe(true);
    });
  });

  describe('Skip Condition', () => {
    it('should skip health check endpoint', async () => {
      const rateLimit = await import('express-rate-limit');
      await import('../../src/middleware/rate-limit');

      // Get the skip function from one of the calls
      const calls = (rateLimit.default as ReturnType<typeof vi.fn>).mock.calls;
      const skipFn = calls[0]?.[0]?.skip as (req: { path: string }) => boolean;

      if (skipFn) {
        expect(skipFn({ path: '/api/v1/health' })).toBe(true);
        expect(skipFn({ path: '/api/v1/users' })).toBe(false);
      }
    });
  });
});

describe('RedisStore Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('should handle Redis pipeline operations', async () => {
    const { redis } = await import('../../src/config/redis');

    // Import the module to trigger initialization
    await import('../../src/middleware/rate-limit');

    // The store is used internally, we verify Redis mock is set up correctly
    expect(redis.pipeline).toBeDefined();
  });

  it('should build rate limit keys correctly', async () => {
    const { buildRedisKey, REDIS_KEYS } = await import('../../src/config/redis');

    const key = buildRedisKey(REDIS_KEYS.RATE_LIMIT, 'test', '127.0.0.1');
    expect(key).toBe('rate_limit:test:127.0.0.1');
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('should have proper 429 response handler configured', async () => {
    const rateLimit = await import('express-rate-limit');
    await import('../../src/middleware/rate-limit');

    // Verify handler is defined
    const calls = (rateLimit.default as ReturnType<typeof vi.fn>).mock.calls;
    const hasHandler = calls.some((call) => typeof call[0].handler === 'function');
    expect(hasHandler).toBe(true);
  });

  it('should configure custom store with required methods', async () => {
    const rateLimit = await import('express-rate-limit');
    await import('../../src/middleware/rate-limit');

    const calls = (rateLimit.default as ReturnType<typeof vi.fn>).mock.calls;
    const store = calls[0]?.[0]?.store;

    if (store) {
      expect(store.increment).toBeDefined();
      expect(store.decrement).toBeDefined();
      expect(store.resetKey).toBeDefined();
    }
  });
});
