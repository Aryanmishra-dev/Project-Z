/**
 * Quiz Sessions Routes Integration Tests
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { Express } from 'express';

// Mock dependencies
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 'test-session-id',
          userId: 'test-user-id',
          pdfId: 'test-pdf-id',
          totalQuestions: 10,
          correctAnswers: 0,
          status: 'in_progress',
          createdAt: new Date(),
          updatedAt: new Date(),
          startedAt: new Date(),
        }]),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
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

describe('Quiz Sessions Routes', () => {
  let app: Express;
  
  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/v1/quiz-sessions', () => {
    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions')
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate pdfId is UUID', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions')
        .set('Authorization', 'Bearer test-token')
        .send({ pdfId: 'invalid-id' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate questionCount range', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions')
        .set('Authorization', 'Bearer test-token')
        .send({ 
          pdfId: '550e8400-e29b-41d4-a716-446655440000',
          questionCount: 100 // Max is 50
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate difficulty enum', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions')
        .set('Authorization', 'Bearer test-token')
        .send({ 
          pdfId: '550e8400-e29b-41d4-a716-446655440000',
          difficulty: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/quiz-sessions', () => {
    it('should return paginated sessions', async () => {
      const response = await request(app)
        .get('/api/v1/quiz-sessions')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('sessions');
      expect(response.body.data).toHaveProperty('total');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v1/quiz-sessions?status=completed')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .get('/api/v1/quiz-sessions?status=invalid')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/quiz-sessions/:id', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .get('/api/v1/quiz-sessions/invalid-id')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/quiz-sessions/:id/answers', () => {
    it('should validate answer submission body', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions/550e8400-e29b-41d4-a716-446655440000/answers')
        .set('Authorization', 'Bearer test-token')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate selectedOption enum', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions/550e8400-e29b-41d4-a716-446655440000/answers')
        .set('Authorization', 'Bearer test-token')
        .send({
          questionId: '550e8400-e29b-41d4-a716-446655440000',
          selectedOption: 'E' // Invalid
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should accept valid answer submission format', async () => {
      // Note: This will fail in ownership check, but validates the schema
      const validBody = {
        questionId: '550e8400-e29b-41d4-a716-446655440000',
        selectedOption: 'A',
        timeSpentSeconds: 30,
        confidenceLevel: 'medium',
      };

      // Schema validation passes, will fail on ownership
      const response = await request(app)
        .post('/api/v1/quiz-sessions/550e8400-e29b-41d4-a716-446655440000/answers')
        .set('Authorization', 'Bearer test-token')
        .send(validBody);

      // Either 403 (ownership) or 404 (not found) - not 400 (validation)
      expect(response.status).not.toBe(400);
    });
  });

  describe('POST /api/v1/quiz-sessions/:id/complete', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions/invalid-id/complete')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/quiz-sessions/:id/abandon', () => {
    it('should return 400 for invalid UUID', async () => {
      const response = await request(app)
        .post('/api/v1/quiz-sessions/invalid-id/abandon')
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});
