/**
 * Questions Routes Integration Tests
 */
import { Express } from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeAll } from 'vitest';

import { createApp } from '../../src/app';

// Mock dependencies
vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([]),
            }),
          }),
          innerJoin: vi.fn().mockResolvedValue([]),
          groupBy: vi.fn().mockResolvedValue([]),
        }),
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
    quit: vi.fn().mockResolvedValue(undefined),
  },
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
  };
});

describe('Questions Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = createApp();
  });

  describe('GET /api/v1/questions', () => {
    it('should require pdfId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/questions')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate pdfId is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/questions?pdfId=invalid-id')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate difficulty enum', async () => {
      const response = await request(app)
        .get('/api/v1/questions?pdfId=550e8400-e29b-41d4-a716-446655440000&difficulty=invalid')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate validationStatus enum', async () => {
      const response = await request(app)
        .get(
          '/api/v1/questions?pdfId=550e8400-e29b-41d4-a716-446655440000&validationStatus=invalid'
        )
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate minQualityScore range', async () => {
      const response = await request(app)
        .get('/api/v1/questions?pdfId=550e8400-e29b-41d4-a716-446655440000&minQualityScore=2')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate limit range', async () => {
      const response = await request(app)
        .get('/api/v1/questions?pdfId=550e8400-e29b-41d4-a716-446655440000&limit=200')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/questions/random', () => {
    it('should require pdfId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/questions/random')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate count range', async () => {
      const response = await request(app)
        .get('/api/v1/questions/random?pdfId=550e8400-e29b-41d4-a716-446655440000&count=100')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate difficulty enum', async () => {
      const response = await request(app)
        .get(
          '/api/v1/questions/random?pdfId=550e8400-e29b-41d4-a716-446655440000&difficulty=invalid'
        )
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/questions/counts', () => {
    it('should require pdfId parameter', async () => {
      const response = await request(app)
        .get('/api/v1/questions/counts')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate pdfId is UUID', async () => {
      const response = await request(app)
        .get('/api/v1/questions/counts?pdfId=invalid')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/questions/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/v1/questions/invalid-id')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
