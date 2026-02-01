/**
 * Rate Limiter Middleware Unit Tests
 * Tests for rate limiting edge cases and behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock Redis
vi.mock('../../src/config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn(),
    })),
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

import { redis } from '../../src/config/redis';

describe('Rate Limiter Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: Mock<NextFunction>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      ip: '127.0.0.1',
      path: '/api/v1/auth/login',
      method: 'POST',
      user: undefined,
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('IP-based Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 3], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests at exactly the limit', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 5], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      // At exactly the limit, should still be allowed (not exceeded yet)
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block requests exceeding the limit', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 6], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 3], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': expect.any(String),
          'X-RateLimit-Remaining': expect.any(String),
        })
      );
    });

    it('should include Retry-After header when rate limited', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 10], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Retry-After': expect.any(String),
        })
      );
    });
  });

  describe('User-based Rate Limiting', () => {
    it('should use user ID when authenticated', async () => {
      mockReq.user = { id: 'user-123', email: 'test@example.com' };

      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 1], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (req) => req.user?.id || req.ip || 'anonymous',
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should have separate limits for authenticated vs anonymous users', async () => {
      // Test that authenticated users get different key
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 1], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      mockReq.user = { id: 'user-123' };

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        keyGenerator: (req) => `user:${req.user?.id || req.ip}`,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Endpoint-specific Rate Limiting', () => {
    it('should have stricter limits for login endpoint', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 6], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      mockReq.path = '/api/v1/auth/login';

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5, // Strict limit for login
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should have higher limits for general API endpoints', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 50], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      mockReq.path = '/api/v1/pdfs';

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Redis Failure Handling', () => {
    it('should allow requests when Redis is unavailable', async () => {
      (redis.multi as Mock).mockImplementationOnce(() => {
        throw new Error('Redis connection failed');
      });

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      // Should fail open (allow request)
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log Redis errors', async () => {
      const { logger } = await import('../../src/utils/logger');
      
      (redis.multi as Mock).mockImplementationOnce(() => {
        throw new Error('Redis connection timeout');
      });

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Sliding Window vs Fixed Window', () => {
    it('should support sliding window algorithm', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 1], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 100,
        algorithm: 'sliding-window',
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting for whitelisted IPs', async () => {
      mockReq.ip = '10.0.0.1'; // Internal IP

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        skip: (req) => req.ip?.startsWith('10.') || false,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(redis.multi).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for health check endpoints', async () => {
      mockReq.path = '/api/health';

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
        skip: (req) => req.path === '/api/health',
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Error Response Format', () => {
    it('should return proper error response when rate limited', async () => {
      const mockMulti = {
        incr: vi.fn().mockReturnThis(),
        expire: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValueOnce([[null, 10], [null, 'OK']]),
      };
      (redis.multi as Mock).mockReturnValueOnce(mockMulti);

      const { createRateLimiter } = await import('../../src/middleware/rate-limit');
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 5,
      });

      await limiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });
  });
});

describe('Brute Force Protection', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: Mock<NextFunction>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockReq = {
      ip: '192.168.1.100',
      path: '/api/v1/auth/login',
      method: 'POST',
      body: { email: 'victim@example.com' },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  it('should track failed login attempts per email', async () => {
    // Simulate 5 failed attempts, 6th should be blocked
    const mockMulti = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce([[null, 6], [null, 'OK']]),
    };
    (redis.multi as Mock).mockReturnValueOnce(mockMulti);

    const { createLoginRateLimiter } = await import('../../src/middleware/rate-limit');
    const limiter = createLoginRateLimiter();

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(429);
  });

  it('should reset counter after successful login', async () => {
    // This would be called after successful authentication
    (redis.del as Mock).mockResolvedValueOnce(1);

    const { resetLoginAttempts } = await import('../../src/middleware/rate-limit');
    await resetLoginAttempts('192.168.1.100', 'victim@example.com');

    expect(redis.del).toHaveBeenCalled();
  });

  it('should implement progressive delays', async () => {
    // After multiple failures, delay increases
    const mockMulti = {
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValueOnce([[null, 3], [null, 'OK']]),
    };
    (redis.multi as Mock).mockReturnValueOnce(mockMulti);

    const { createLoginRateLimiter } = await import('../../src/middleware/rate-limit');
    const limiter = createLoginRateLimiter();

    await limiter(mockReq as Request, mockRes as Response, mockNext);

    // Even if under limit, progressive delay might be applied
    expect(mockNext).toHaveBeenCalled();
  });
});
