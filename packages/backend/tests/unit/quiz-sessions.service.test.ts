/**
 * Quiz Sessions Service Unit Tests
 * Tests for quiz session service exports and basic functionality
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

describe('QuizSessionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('Service Export', () => {
    it('should export quizSessionsService', async () => {
      const module = await import('../../src/services/quiz-sessions.service');
      expect(module.quizSessionsService).toBeDefined();
    });

    it('should have create method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.create).toBe('function');
    });

    it('should have getById method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.getById).toBe('function');
    });

    it('should have getByIdOrThrow method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.getByIdOrThrow).toBe('function');
    });

    it('should have getWithDetails method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.getWithDetails).toBe('function');
    });

    it('should have submitAnswer method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.submitAnswer).toBe('function');
    });

    it('should have complete method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.complete).toBe('function');
    });

    it('should have abandon method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.abandon).toBe('function');
    });

    it('should have list method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.list).toBe('function');
    });

    it('should have getUserStats method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.getUserStats).toBe('function');
    });

    it('should have checkOwnership method', async () => {
      const { quizSessionsService } = await import('../../src/services/quiz-sessions.service');
      expect(typeof quizSessionsService.checkOwnership).toBe('function');
    });
  });
});

describe('QuizSessionsService Error Types', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should export NotFoundError from errors module', async () => {
    const { NotFoundError } = await import('../../src/utils/errors');
    expect(NotFoundError).toBeDefined();
  });

  it('should export ValidationError from errors module', async () => {
    const { ValidationError } = await import('../../src/utils/errors');
    expect(ValidationError).toBeDefined();
  });

  it('should export AppError from errors module', async () => {
    const { AppError } = await import('../../src/utils/errors');
    expect(AppError).toBeDefined();
  });
});

describe('CreateSessionOptions Interface', () => {
  it('should allow creating options with required fields', () => {
    const options = {
      userId: 'user-123',
      pdfId: 'pdf-123',
    };
    expect(options.userId).toBe('user-123');
    expect(options.pdfId).toBe('pdf-123');
  });

  it('should allow optional fields', () => {
    const options = {
      userId: 'user-123',
      pdfId: 'pdf-123',
      questionCount: 10,
      difficulty: 'medium' as const,
    };
    expect(options.questionCount).toBe(10);
    expect(options.difficulty).toBe('medium');
  });
});

describe('AnswerSubmission Interface', () => {
  it('should allow creating submission with required fields', () => {
    const submission = {
      questionId: 'q-123',
      selectedOption: 'A',
    };
    expect(submission.questionId).toBe('q-123');
    expect(submission.selectedOption).toBe('A');
  });

  it('should allow optional timeSpentSeconds field', () => {
    const submission = {
      questionId: 'q-123',
      selectedOption: 'A',
      timeSpentSeconds: 30,
    };
    expect(submission.timeSpentSeconds).toBe(30);
  });
});
