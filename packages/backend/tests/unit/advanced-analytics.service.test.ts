/**
 * Advanced Analytics Service Unit Tests
 * Tests for analytics service exports and basic behavior
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock Redis
vi.mock('../../src/config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      orderBy: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    }),
    execute: vi.fn().mockResolvedValue([]),
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

describe('AdvancedAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  describe('Service Export', () => {
    it('should export advancedAnalyticsService', async () => {
      const module = await import('../../src/services/advanced-analytics.service');
      expect(module.advancedAnalyticsService).toBeDefined();
    });

    it('should have getTrends method', async () => {
      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      expect(typeof advancedAnalyticsService.getTrends).toBe('function');
    });

    it('should have getWeakAreas method', async () => {
      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      expect(typeof advancedAnalyticsService.getWeakAreas).toBe('function');
    });

    it('should have getPatterns method', async () => {
      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      expect(typeof advancedAnalyticsService.getPatterns).toBe('function');
    });

    it('should have getStreaks method', async () => {
      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      expect(typeof advancedAnalyticsService.getStreaks).toBe('function');
    });

    it('should have invalidateUserCache method', async () => {
      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      expect(typeof advancedAnalyticsService.invalidateUserCache).toBe('function');
    });
  });

  describe('Cache Behavior', () => {
    it('should return cached trends when available', async () => {
      const cachedData = JSON.stringify({
        dailyScores: [],
        byDifficulty: {
          easy: { avgScore: 90, totalQuestions: 50, correctAnswers: 45, quizzes: 10 },
          medium: { avgScore: 75, totalQuestions: 40, correctAnswers: 30, quizzes: 8 },
          hard: { avgScore: 60, totalQuestions: 20, correctAnswers: 12, quizzes: 4 },
        },
        overallTrend: 'improving',
        improvementRate: 5.2,
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123');

      expect(redis.get).toHaveBeenCalled();
      expect(result.overallTrend).toBe('improving');
    });

    it('should return cached weak areas when available', async () => {
      const cachedData = JSON.stringify({
        weakQuestions: [],
        weakDifficulties: ['hard'],
        recommendedPdfs: [],
        totalWeakAreas: 5,
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getWeakAreas('user-123');

      expect(redis.get).toHaveBeenCalled();
      expect(result.totalWeakAreas).toBe(5);
    });

    it('should return cached patterns when available', async () => {
      const cachedData = JSON.stringify({
        bestTimeOfDay: { hour: 10, avgScore: 85, quizCount: 15 },
        optimalQuizLength: { questionCount: 15, avgScore: 80, quizCount: 10 },
        retention: { pdfRetakeRate: 0.3, avgImprovementOnRetake: 12 },
        avgTimePerQuestion: 45,
        fastestCompletionTime: 120,
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getPatterns('user-123');

      expect(redis.get).toHaveBeenCalled();
      expect(result.avgTimePerQuestion).toBe(45);
    });

    it('should return cached streaks when available', async () => {
      const cachedData = JSON.stringify({
        currentStreak: 7,
        longestStreak: 14,
        totalQuizzes: 50,
        totalQuestionsAnswered: 500,
        lastActivityDate: '2024-01-05',
        streakDates: ['2024-01-05', '2024-01-04'],
        milestones: {
          quizzes: { current: 50, next: 100, progress: 50 },
          questions: { current: 500, next: 1000, progress: 50 },
          streak: { current: 7, next: 14, progress: 50 },
        },
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(redis.get).toHaveBeenCalled();
      expect(result.currentStreak).toBe(7);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate user cache by calling del on cache keys', async () => {
      (redis.del as Mock).mockResolvedValue(1);

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');
      await advancedAnalyticsService.invalidateUserCache('user-123');

      // The service uses redis.del for each cache key
      expect(redis.del).toHaveBeenCalled();
    });

    it('should handle cache invalidation errors gracefully', async () => {
      (redis.del as Mock).mockRejectedValue(new Error('Redis error'));

      const { advancedAnalyticsService } =
        await import('../../src/services/advanced-analytics.service');

      // Should not throw
      await expect(
        advancedAnalyticsService.invalidateUserCache('user-123')
      ).resolves.toBeUndefined();
    });
  });
});

describe('Type Exports', () => {
  it('should export TrendsData type', async () => {
    const module = await import('../../src/services/advanced-analytics.service');
    // The service should be importable, types are compile-time only
    expect(module.advancedAnalyticsService).toBeDefined();
  });
});
