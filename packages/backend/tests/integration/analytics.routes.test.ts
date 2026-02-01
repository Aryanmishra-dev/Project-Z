/**
 * Analytics Routes Integration Tests
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Express } from 'express';

// Mock dependencies
vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      }),
    }),
  },
}));

vi.mock('../../src/config/redis', () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue('PONG'),
    quit: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/queues', () => ({
  getQueueStats: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 10,
    failed: 1,
    delayed: 0,
  }),
}));

vi.mock('../../src/workers', () => ({
  isWorkerRunning: vi.fn().mockReturnValue(true),
}));

vi.mock('../../src/middleware/auth', async () => {
  const actual = await vi.importActual('../../src/middleware/auth');
  return {
    ...actual,
    authenticate: vi.fn((req, _res, next) => {
      req.user = {
        sub: 'test-user-id',
        email: 'test@example.com',
        role: 'user',
      };
      next();
    }),
    authorize: vi.fn((role) => (req: any, res: any, next: any) => {
      if (req.user?.role === role || req.user?.role === 'admin') {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Admin access required' },
        });
      }
    }),
  };
});

describe('Analytics Routes', () => {
  let app: Express;
  
  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/v1/analytics/dashboard', () => {
    it('should return dashboard statistics', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('pdfs');
      expect(response.body.data).toHaveProperty('quizzes');
      expect(response.body.data).toHaveProperty('recentActivity');
    });

    it('should accept refresh parameter', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/dashboard?refresh=true')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/analytics/queue', () => {
    it('should require admin role', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/queue')
        .set('Authorization', 'Bearer test-token')
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/analytics/health', () => {
    it('should return system health status', async () => {
      const response = await request(app)
        .get('/api/v1/analytics/health')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('components');
      expect(response.body.data).toHaveProperty('timestamp');
    });
  });

  describe('POST /api/v1/analytics/invalidate-cache', () => {
    it('should invalidate user cache', async () => {
      const response = await request(app)
        .post('/api/v1/analytics/invalidate-cache')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Analytics cache invalidated');
    });
  });
});
