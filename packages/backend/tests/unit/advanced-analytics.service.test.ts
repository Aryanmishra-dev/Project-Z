/**
 * Advanced Analytics Service Unit Tests
 * Tests for trends, patterns, weak areas, and streaks
 */
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';

// Mock Redis
vi.mock('ioredis', () => {
  const mockRedis = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  };
  return {
    default: vi.fn(() => mockRedis),
    Redis: vi.fn(() => mockRedis),
  };
});

vi.mock('../../src/db', () => ({
  db: {
    select: vi.fn(),
    execute: vi.fn(),
  },
}));

vi.mock('../../src/config/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
    pipeline: vi.fn(() => ({
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
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
import { db } from '../../src/db';

describe('AdvancedAnalyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTrends', () => {
    it('should return cached trends data when available', async () => {
      const cachedData = JSON.stringify({
        overall: {
          currentScore: 85,
          previousScore: 75,
          percentageChange: 13.33,
          trend: 'up',
          dataPoints: [],
        },
        byDifficulty: {},
        period: '30d',
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '30d');

      expect(redis.get).toHaveBeenCalled();
      expect(result.overall.currentScore).toBe(85);
    });

    it('should calculate trends from database when cache misses', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      // Mock database queries for trend calculation
      const mockScores = [
        { date: '2024-01-01', avgScore: 75, quizCount: 3 },
        { date: '2024-01-02', avgScore: 80, quizCount: 2 },
        { date: '2024-01-03', avgScore: 85, quizCount: 4 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockScores);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '7d');

      expect(db.execute).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
    });

    it('should calculate correct trend direction (up)', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockScores = [
        { date: '2024-01-01', avgScore: 70, quizCount: 1 },
        { date: '2024-01-07', avgScore: 90, quizCount: 1 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockScores);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '7d');

      expect(result.overall.trend).toBe('up');
    });

    it('should calculate correct trend direction (down)', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockScores = [
        { date: '2024-01-01', avgScore: 90, quizCount: 1 },
        { date: '2024-01-07', avgScore: 60, quizCount: 1 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockScores);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '7d');

      expect(result.overall.trend).toBe('down');
    });

    it('should handle stable trend (no significant change)', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockScores = [
        { date: '2024-01-01', avgScore: 75, quizCount: 1 },
        { date: '2024-01-07', avgScore: 76, quizCount: 1 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockScores);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '7d');

      expect(result.overall.trend).toBe('stable');
    });

    it('should return empty data for user with no quiz history', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      (db.execute as Mock).mockResolvedValueOnce([]);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('new-user', '30d');

      expect(result.overall.dataPoints).toHaveLength(0);
    });

    it('should calculate by-difficulty breakdown', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      (db.execute as Mock)
        .mockResolvedValueOnce([]) // Overall scores
        .mockResolvedValueOnce([ // By difficulty
          { difficulty: 'easy', avgScore: 90, totalQuestions: 50 },
          { difficulty: 'medium', avgScore: 75, totalQuestions: 40 },
          { difficulty: 'hard', avgScore: 60, totalQuestions: 20 },
        ]);

      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getTrends('user-123', '30d');

      expect(result.byDifficulty).toBeDefined();
    });
  });

  describe('getWeakAreas', () => {
    it('should return cached weak areas when available', async () => {
      const cachedData = JSON.stringify([
        {
          category: 'JavaScript',
          topic: 'Closures',
          errorRate: 0.45,
          lastAttempted: '2024-01-05',
          suggestedResources: [],
        },
      ]);

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getWeakAreas('user-123');

      expect(result[0].category).toBe('JavaScript');
    });

    it('should identify weak areas from incorrect answers', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockWeakAreas = [
        {
          category: 'React',
          topic: 'Hooks',
          totalAttempts: 20,
          incorrectAttempts: 12,
          lastAttemptDate: new Date('2024-01-05'),
        },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockWeakAreas);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getWeakAreas('user-123');

      expect(result[0].errorRate).toBe(0.6); // 12/20
    });

    it('should sort weak areas by error rate descending', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockWeakAreas = [
        { category: 'A', topic: 'T1', totalAttempts: 10, incorrectAttempts: 3, lastAttemptDate: new Date() },
        { category: 'B', topic: 'T2', totalAttempts: 10, incorrectAttempts: 8, lastAttemptDate: new Date() },
        { category: 'C', topic: 'T3', totalAttempts: 10, incorrectAttempts: 5, lastAttemptDate: new Date() },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockWeakAreas);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getWeakAreas('user-123');

      // Should be sorted: B (0.8), C (0.5), A (0.3)
      expect(result[0].category).toBe('B');
    });

    it('should limit weak areas to top 10', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockWeakAreas = Array.from({ length: 15 }, (_, i) => ({
        category: `Category${i}`,
        topic: `Topic${i}`,
        totalAttempts: 10,
        incorrectAttempts: 5,
        lastAttemptDate: new Date(),
      }));

      (db.execute as Mock).mockResolvedValueOnce(mockWeakAreas);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getWeakAreas('user-123');

      expect(result.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getPatterns', () => {
    it('should return cached patterns when available', async () => {
      const cachedData = JSON.stringify({
        bestTimeOfDay: 'morning',
        optimalQuizLength: 15,
        averageTimePerQuestion: 45,
        retentionRate: 78,
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getPatterns('user-123');

      expect(result.bestTimeOfDay).toBe('morning');
    });

    it('should calculate best time of day based on performance', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockTimeData = [
        { hourOfDay: 9, avgScore: 90, quizCount: 5 },  // Morning
        { hourOfDay: 14, avgScore: 75, quizCount: 5 }, // Afternoon
        { hourOfDay: 20, avgScore: 70, quizCount: 5 }, // Evening
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockTimeData);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getPatterns('user-123');

      expect(result.bestTimeOfDay).toBe('morning');
    });

    it('should calculate optimal quiz length', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockQuizLengthData = [
        { questionCount: 5, avgScore: 85 },
        { questionCount: 10, avgScore: 90 },
        { questionCount: 15, avgScore: 88 },
        { questionCount: 20, avgScore: 75 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockQuizLengthData);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getPatterns('user-123');

      expect(result.optimalQuizLength).toBe(10); // Highest score
    });

    it('should calculate retention rate from repeat question performance', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockRetentionData = {
        firstAttemptCorrect: 70,
        repeatAttemptCorrect: 90,
        totalRepeats: 100,
      };

      (db.execute as Mock).mockResolvedValueOnce([mockRetentionData]);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getPatterns('user-123');

      expect(result.retentionRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getStreaks', () => {
    it('should return cached streaks when available', async () => {
      const cachedData = JSON.stringify({
        currentStreak: 7,
        longestStreak: 14,
        lastActivityDate: '2024-01-05',
        activityHistory: [],
        milestones: [],
      });

      (redis.get as Mock).mockResolvedValueOnce(cachedData);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(result.currentStreak).toBe(7);
    });

    it('should calculate current streak from consecutive days', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const today = new Date();
      const mockActivityDates = [
        { date: new Date(today.getTime() - 0 * 24 * 60 * 60 * 1000) }, // Today
        { date: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000) }, // Yesterday
        { date: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000) }, // 2 days ago
        { date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000) }, // 3 days ago
        // Gap
        { date: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000) },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockActivityDates);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(result.currentStreak).toBe(4);
    });

    it('should reset current streak if last activity was not today or yesterday', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const today = new Date();
      const mockActivityDates = [
        { date: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000) }, // 5 days ago
        { date: new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000) },
        { date: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockActivityDates);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(result.currentStreak).toBe(0);
    });

    it('should track longest streak separately from current', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      (db.execute as Mock).mockResolvedValueOnce([]);
      (db.execute as Mock).mockResolvedValueOnce([{ longestStreak: 30 }]);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(result.longestStreak).toBe(30);
    });

    it('should include activity history for heatmap', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const mockActivityHistory = [
        { date: '2024-01-01', quizCount: 3 },
        { date: '2024-01-02', quizCount: 1 },
        { date: '2024-01-03', quizCount: 5 },
      ];

      (db.execute as Mock).mockResolvedValueOnce(mockActivityHistory);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      expect(result.activityHistory).toBeDefined();
    });

    it('should calculate milestone progress', async () => {
      (redis.get as Mock).mockResolvedValueOnce(null);
      
      const today = new Date();
      // 8 consecutive days of activity
      const mockActivityDates = Array.from({ length: 8 }, (_, i) => ({
        date: new Date(today.getTime() - i * 24 * 60 * 60 * 1000),
      }));

      (db.execute as Mock).mockResolvedValueOnce(mockActivityDates);
      (redis.set as Mock).mockResolvedValueOnce('OK');

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      const result = await advancedAnalyticsService.getStreaks('user-123');

      // 7-day milestone should be achieved
      const sevenDayMilestone = result.milestones.find(m => m.days === 7);
      expect(sevenDayMilestone?.achieved).toBe(true);
    });
  });

  describe('invalidateUserCache', () => {
    it('should clear all cached analytics for user', async () => {
      const mockKeys = [
        'analytics:user-123:trends:7d',
        'analytics:user-123:trends:30d',
        'analytics:user-123:weak-areas',
        'analytics:user-123:patterns',
        'analytics:user-123:streaks',
      ];

      (redis.keys as Mock).mockResolvedValueOnce(mockKeys);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      await advancedAnalyticsService.invalidateUserCache('user-123');

      expect(redis.keys).toHaveBeenCalledWith('analytics:user-123:*');
    });

    it('should handle empty cache gracefully', async () => {
      (redis.keys as Mock).mockResolvedValueOnce([]);

      const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
      
      // Should not throw
      await expect(
        advancedAnalyticsService.invalidateUserCache('user-123')
      ).resolves.toBeUndefined();
    });
  });
});

describe('Cache TTL Behavior', () => {
  it('should use appropriate TTL for trends (300s)', async () => {
    (redis.get as Mock).mockResolvedValueOnce(null);
    (db.execute as Mock).mockResolvedValueOnce([]);
    (redis.set as Mock).mockResolvedValueOnce('OK');

    const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
    await advancedAnalyticsService.getTrends('user-123', '7d');

    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'EX',
      300
    );
  });

  it('should use appropriate TTL for streaks (60s)', async () => {
    (redis.get as Mock).mockResolvedValueOnce(null);
    (db.execute as Mock).mockResolvedValueOnce([]);
    (redis.set as Mock).mockResolvedValueOnce('OK');

    const { advancedAnalyticsService } = await import('../../src/services/advanced-analytics.service');
    await advancedAnalyticsService.getStreaks('user-123');

    expect(redis.set).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'EX',
      60
    );
  });
});
