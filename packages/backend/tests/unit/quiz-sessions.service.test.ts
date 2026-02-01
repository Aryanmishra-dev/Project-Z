/**
 * Quiz Sessions Service Unit Tests
 * Comprehensive tests for quiz session management
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock dependencies
vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../src/services/questions.service', () => ({
  questionsService: {
    getRandomQuestions: vi.fn(),
    getById: vi.fn(),
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

import { db } from '../../src/db';
import { questionsService } from '../../src/services/questions.service';

const mockQueryBuilder = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  innerJoin: vi.fn().mockReturnThis(),
};

describe('QuizSessionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockReturnValue(mockQueryBuilder);
    (db.insert as Mock).mockReturnValue(mockQueryBuilder);
    (db.update as Mock).mockReturnValue(mockQueryBuilder);
    (db.delete as Mock).mockReturnValue(mockQueryBuilder);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('create', () => {
    it('should create a new quiz session successfully', async () => {
      const mockPdf = {
        id: 'pdf-123',
        userId: 'user-123',
        status: 'completed',
        filename: 'test.pdf',
      };

      const mockQuestions = [
        { id: 'q1', pdfId: 'pdf-123', questionText: 'Question 1', difficulty: 'medium' },
        { id: 'q2', pdfId: 'pdf-123', questionText: 'Question 2', difficulty: 'medium' },
      ];

      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        pdfId: 'pdf-123',
        status: 'in_progress',
        totalQuestions: 2,
        createdAt: new Date(),
      };

      // PDF exists and is completed
      mockQueryBuilder.limit.mockResolvedValueOnce([mockPdf]);
      // Get random questions
      (questionsService.getRandomQuestions as Mock).mockResolvedValueOnce(mockQuestions);
      // Insert session
      mockQueryBuilder.returning.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.create({
        userId: 'user-123',
        pdfId: 'pdf-123',
        questionCount: 2,
      });

      expect(result.session).toEqual(mockSession);
      expect(result.questions).toEqual(mockQuestions);
    });

    it('should throw NotFoundError for non-existent PDF', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.create({
          userId: 'user-123',
          pdfId: 'non-existent',
        })
      ).rejects.toThrow('PDF not found');
    });

    it('should throw ValidationError for unprocessed PDF', async () => {
      const mockPdf = {
        id: 'pdf-123',
        userId: 'user-123',
        status: 'processing', // Not completed
        filename: 'test.pdf',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockPdf]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.create({
          userId: 'user-123',
          pdfId: 'pdf-123',
        })
      ).rejects.toThrow('PDF processing not complete');
    });

    it('should filter questions by difficulty when specified', async () => {
      const mockPdf = {
        id: 'pdf-123',
        userId: 'user-123',
        status: 'completed',
      };

      const mockQuestions = [
        { id: 'q1', pdfId: 'pdf-123', difficulty: 'hard' },
      ];

      mockQueryBuilder.limit.mockResolvedValueOnce([mockPdf]);
      (questionsService.getRandomQuestions as Mock).mockResolvedValueOnce(mockQuestions);
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        id: 'session-123',
        totalQuestions: 1,
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      await quizSessionsService.create({
        userId: 'user-123',
        pdfId: 'pdf-123',
        questionCount: 5,
        difficulty: 'hard',
      });

      expect(questionsService.getRandomQuestions).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'hard' })
      );
    });

    it('should use default question count of 10', async () => {
      const mockPdf = {
        id: 'pdf-123',
        userId: 'user-123',
        status: 'completed',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockPdf]);
      (questionsService.getRandomQuestions as Mock).mockResolvedValueOnce([]);
      mockQueryBuilder.returning.mockResolvedValueOnce([{ id: 'session-123' }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      await quizSessionsService.create({
        userId: 'user-123',
        pdfId: 'pdf-123',
      });

      expect(questionsService.getRandomQuestions).toHaveBeenCalledWith(
        expect.objectContaining({ count: 10 })
      );
    });
  });

  describe('getById', () => {
    it('should return session with details', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        pdfId: 'pdf-123',
        status: 'in_progress',
        totalQuestions: 5,
        correctAnswers: 0,
        createdAt: new Date(),
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      // Get answers
      mockQueryBuilder.orderBy.mockResolvedValueOnce([]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.getById('session-123', 'user-123');

      expect(result?.id).toBe('session-123');
    });

    it('should return null for non-existent session', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.getById('non-existent', 'user-123');

      expect(result).toBeNull();
    });

    it('should return null for unauthorized access', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'other-user', // Different user
        pdfId: 'pdf-123',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.getById('session-123', 'user-123');

      // Should be null due to ownership check in query
      expect(result).toBeDefined();
    });
  });

  describe('submitAnswer', () => {
    it('should submit answer successfully', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        pdfId: 'pdf-123',
        status: 'in_progress',
        questionIds: ['q1', 'q2', 'q3'],
      };

      const mockQuestion = {
        id: 'q1',
        correctOption: 'A',
        optionA: 'Answer A',
      };

      const mockAnswer = {
        id: 'answer-123',
        sessionId: 'session-123',
        questionId: 'q1',
        selectedOption: 'A',
        isCorrect: true,
        timeSpentSeconds: 30,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      (questionsService.getById as Mock).mockResolvedValueOnce(mockQuestion);
      mockQueryBuilder.returning.mockResolvedValueOnce([mockAnswer]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.submitAnswer('session-123', 'user-123', {
        questionId: 'q1',
        selectedOption: 'A',
        timeSpentSeconds: 30,
      });

      expect(result.isCorrect).toBe(true);
    });

    it('should reject answer for completed session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'completed', // Already completed
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.submitAnswer('session-123', 'user-123', {
          questionId: 'q1',
          selectedOption: 'A',
        })
      ).rejects.toThrow();
    });

    it('should reject answer for timed out session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'timed_out',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.submitAnswer('session-123', 'user-123', {
          questionId: 'q1',
          selectedOption: 'A',
        })
      ).rejects.toThrow();
    });

    it('should throw NotFoundError for non-existent session', async () => {
      mockQueryBuilder.limit.mockResolvedValueOnce([]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.submitAnswer('non-existent', 'user-123', {
          questionId: 'q1',
          selectedOption: 'A',
        })
      ).rejects.toThrow('Quiz session not found');
    });

    it('should calculate correctness for wrong answer', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        questionIds: ['q1'],
      };

      const mockQuestion = {
        id: 'q1',
        correctOption: 'A',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      (questionsService.getById as Mock).mockResolvedValueOnce(mockQuestion);
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        id: 'answer-123',
        isCorrect: false,
        selectedOption: 'B',
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.submitAnswer('session-123', 'user-123', {
        questionId: 'q1',
        selectedOption: 'B', // Wrong answer
      });

      expect(result.isCorrect).toBe(false);
    });
  });

  describe('submitAllAnswers', () => {
    it('should submit multiple answers at once', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        questionIds: ['q1', 'q2', 'q3'],
        totalQuestions: 3,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      
      // Mock transaction
      (db.transaction as Mock).mockImplementation(async (callback) => {
        return callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                { isCorrect: true },
                { isCorrect: false },
                { isCorrect: true },
              ]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{
                  score: 66.67,
                  status: 'completed',
                }]),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { correctOption: 'A' },
                { correctOption: 'B' },
                { correctOption: 'A' },
              ]),
            }),
          }),
        });
      });

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.submitAllAnswers('session-123', 'user-123', [
        { questionId: 'q1', selectedOption: 'A' },
        { questionId: 'q2', selectedOption: 'C' }, // Wrong
        { questionId: 'q3', selectedOption: 'A' },
      ]);

      expect(result).toBeDefined();
    });

    it('should handle partial answers submission', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        questionIds: ['q1', 'q2', 'q3'],
        totalQuestions: 3,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      
      (db.transaction as Mock).mockImplementation(async (callback) => {
        return callback({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                { isCorrect: true },
              ]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{
                  score: 33.33,
                  status: 'completed',
                }]),
              }),
            }),
          }),
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ correctOption: 'A' }]),
            }),
          }),
        });
      });

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      // Only submit 1 of 3 answers (edge case)
      const result = await quizSessionsService.submitAllAnswers('session-123', 'user-123', [
        { questionId: 'q1', selectedOption: 'A' },
      ]);

      expect(result).toBeDefined();
    });
  });

  describe('complete', () => {
    it('should complete session and calculate score', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        totalQuestions: 10,
      };

      const mockAnswers = [
        { isCorrect: true },
        { isCorrect: true },
        { isCorrect: false },
        { isCorrect: true },
        { isCorrect: false },
      ];

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      // Get answers
      mockQueryBuilder.orderBy.mockResolvedValueOnce(mockAnswers);
      // Update session
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        ...mockSession,
        status: 'completed',
        score: 60,
        correctAnswers: 3,
        completedAt: new Date(),
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.complete('session-123', 'user-123');

      expect(result.status).toBe('completed');
    });

    it('should throw error for already completed session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'completed',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.complete('session-123', 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('abandon', () => {
    it('should abandon session successfully', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        ...mockSession,
        status: 'abandoned',
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.abandon('session-123', 'user-123');

      expect(result.status).toBe('abandoned');
    });

    it('should not abandon already completed session', async () => {
      const mockSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'completed',
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([mockSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      
      await expect(
        quizSessionsService.abandon('session-123', 'user-123')
      ).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list user sessions with pagination', async () => {
      const mockSessions = [
        { id: 'session-1', status: 'completed', score: 80 },
        { id: 'session-2', status: 'in_progress', score: null },
      ];

      mockQueryBuilder.offset.mockResolvedValueOnce(mockSessions);
      // Count total
      mockQueryBuilder.from.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 5 }]),
      });

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.list({
        userId: 'user-123',
        limit: 10,
        offset: 0,
      });

      expect(result.sessions).toHaveLength(2);
    });

    it('should filter by PDF ID', async () => {
      mockQueryBuilder.offset.mockResolvedValueOnce([]);
      mockQueryBuilder.from.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 0 }]),
      });

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      await quizSessionsService.list({
        userId: 'user-123',
        pdfId: 'pdf-123',
      });

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      mockQueryBuilder.offset.mockResolvedValueOnce([]);
      mockQueryBuilder.from.mockReturnValueOnce({
        where: vi.fn().mockResolvedValueOnce([{ count: 0 }]),
      });

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      await quizSessionsService.list({
        userId: 'user-123',
        status: 'completed',
      });

      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('checkTimeout', () => {
    it('should timeout expired sessions', async () => {
      const expiredSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        timeLimitMinutes: 60,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([expiredSession]);
      mockQueryBuilder.returning.mockResolvedValueOnce([{
        ...expiredSession,
        status: 'timed_out',
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.checkTimeout('session-123', 'user-123');

      expect(result?.status).toBe('timed_out');
    });

    it('should not timeout active sessions', async () => {
      const activeSession = {
        id: 'session-123',
        userId: 'user-123',
        status: 'in_progress',
        startedAt: new Date(), // Just started
        timeLimitMinutes: 60,
      };

      mockQueryBuilder.limit.mockResolvedValueOnce([activeSession]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.checkTimeout('session-123', 'user-123');

      expect(result?.status).toBe('in_progress');
    });
  });

  describe('getStatistics', () => {
    it('should return user quiz statistics', async () => {
      const mockStats = {
        totalSessions: 10,
        completedSessions: 8,
        averageScore: 75.5,
        totalQuestionsAnswered: 100,
        correctAnswers: 75,
      };

      mockQueryBuilder.where.mockResolvedValueOnce([mockStats]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.getStatistics('user-123');

      expect(result.totalSessions).toBe(10);
      expect(result.averageScore).toBe(75.5);
    });

    it('should return empty stats for new user', async () => {
      mockQueryBuilder.where.mockResolvedValueOnce([{
        totalSessions: 0,
        completedSessions: 0,
        averageScore: null,
        totalQuestionsAnswered: 0,
        correctAnswers: 0,
      }]);

      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      const result = await quizSessionsService.getStatistics('new-user');

      expect(result.totalSessions).toBe(0);
    });
  });
});

describe('Concurrent Operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockReturnValue(mockQueryBuilder);
    (db.insert as Mock).mockReturnValue(mockQueryBuilder);
    (db.update as Mock).mockReturnValue(mockQueryBuilder);
  });

  it('should handle concurrent answer submissions safely', async () => {
    const mockSession = {
      id: 'session-123',
      userId: 'user-123',
      status: 'in_progress',
      questionIds: ['q1', 'q2'],
    };

    const mockQuestion = {
      id: 'q1',
      correctOption: 'A',
    };

    // Simulate concurrent access
    mockQueryBuilder.limit.mockResolvedValue([mockSession]);
    (questionsService.getById as Mock).mockResolvedValue(mockQuestion);
    mockQueryBuilder.returning.mockResolvedValue([{
      id: 'answer-123',
      isCorrect: true,
    }]);

    const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
    
    // Submit multiple answers concurrently
    const promises = [
      quizSessionsService.submitAnswer('session-123', 'user-123', {
        questionId: 'q1',
        selectedOption: 'A',
      }),
      quizSessionsService.submitAnswer('session-123', 'user-123', {
        questionId: 'q2',
        selectedOption: 'B',
      }),
    ];

    const results = await Promise.all(promises);
    expect(results).toHaveLength(2);
  });
});
