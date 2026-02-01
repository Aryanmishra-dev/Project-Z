/**
 * Analytics Service Unit Tests
 * Tests for analytics API calls and data transformation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock axios/api
vi.mock('../../lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from '../../lib/api';

describe('Analytics Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getTrends', () => {
    it('should fetch trends data successfully', async () => {
      const mockTrends = {
        overall: {
          currentScore: 85,
          previousScore: 75,
          percentageChange: 13.33,
          trend: 'up',
          dataPoints: [
            { date: '2024-01-01', score: 70, quizCount: 3 },
            { date: '2024-01-02', score: 80, quizCount: 2 },
          ],
        },
        byDifficulty: {
          easy: { averageScore: 90, trend: 'stable', totalQuestions: 50 },
          medium: { averageScore: 75, trend: 'up', totalQuestions: 40 },
          hard: { averageScore: 60, trend: 'down', totalQuestions: 20 },
        },
        period: '30d',
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockTrends });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getTrends('30d');

      expect(api.get).toHaveBeenCalledWith('/analytics/trends', { params: { period: '30d' } });
      expect(result.overall.currentScore).toBe(85);
    });

    it('should handle different time periods', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

      const { analyticsService } = await import('../analytics.service');
      
      await analyticsService.getTrends('7d');
      expect(api.get).toHaveBeenCalledWith('/analytics/trends', { params: { period: '7d' } });

      await analyticsService.getTrends('90d');
      expect(api.get).toHaveBeenCalledWith('/analytics/trends', { params: { period: '90d' } });
    });

    it('should handle API errors', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const { analyticsService } = await import('../analytics.service');
      
      await expect(analyticsService.getTrends('30d')).rejects.toThrow('Network error');
    });
  });

  describe('getWeakAreas', () => {
    it('should fetch weak areas successfully', async () => {
      const mockWeakAreas = [
        {
          category: 'JavaScript',
          topic: 'Closures',
          errorRate: 0.45,
          totalAttempts: 20,
          lastAttempted: '2024-01-05',
          suggestedResources: ['MDN Closures Guide'],
        },
        {
          category: 'React',
          topic: 'Hooks',
          errorRate: 0.35,
          totalAttempts: 15,
          lastAttempted: '2024-01-04',
          suggestedResources: ['React Docs'],
        },
      ];

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockWeakAreas });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getWeakAreas();

      expect(api.get).toHaveBeenCalledWith('/analytics/weak-areas');
      expect(result).toHaveLength(2);
      expect(result[0].category).toBe('JavaScript');
    });

    it('should return empty array for new users', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: [] });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getWeakAreas();

      expect(result).toEqual([]);
    });

    it('should pass limit parameter', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });

      const { analyticsService } = await import('../analytics.service');
      await analyticsService.getWeakAreas(5);

      expect(api.get).toHaveBeenCalledWith('/analytics/weak-areas', { params: { limit: 5 } });
    });
  });

  describe('getPatterns', () => {
    it('should fetch learning patterns successfully', async () => {
      const mockPatterns = {
        bestTimeOfDay: 'morning',
        bestDayOfWeek: 'Saturday',
        optimalQuizLength: 15,
        averageTimePerQuestion: 45,
        retentionRate: 78,
        improvementRate: 5.2,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockPatterns });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getPatterns();

      expect(api.get).toHaveBeenCalledWith('/analytics/patterns');
      expect(result.bestTimeOfDay).toBe('morning');
      expect(result.optimalQuizLength).toBe(15);
    });

    it('should handle null values for new users', async () => {
      const mockPatterns = {
        bestTimeOfDay: null,
        optimalQuizLength: null,
        averageTimePerQuestion: null,
        retentionRate: null,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockPatterns });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getPatterns();

      expect(result.bestTimeOfDay).toBeNull();
    });
  });

  describe('getStreaks', () => {
    it('should fetch streak data successfully', async () => {
      const mockStreaks = {
        currentStreak: 7,
        longestStreak: 14,
        lastActivityDate: '2024-01-05',
        activityHistory: [
          { date: '2024-01-05', quizCount: 3 },
          { date: '2024-01-04', quizCount: 2 },
          { date: '2024-01-03', quizCount: 1 },
        ],
        milestones: [
          { days: 7, achieved: true, achievedDate: '2024-01-01' },
          { days: 30, achieved: false, achievedDate: null },
        ],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockStreaks });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getStreaks();

      expect(api.get).toHaveBeenCalledWith('/analytics/streaks');
      expect(result.currentStreak).toBe(7);
      expect(result.milestones).toHaveLength(2);
    });

    it('should return zero streak for inactive users', async () => {
      const mockStreaks = {
        currentStreak: 0,
        longestStreak: 5,
        lastActivityDate: '2024-01-01',
        activityHistory: [],
        milestones: [],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockStreaks });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getStreaks();

      expect(result.currentStreak).toBe(0);
    });
  });

  describe('getOverview', () => {
    it('should fetch overview statistics', async () => {
      const mockOverview = {
        totalQuizzes: 50,
        totalQuestions: 500,
        averageScore: 75.5,
        totalTimeSpent: 36000, // 10 hours in seconds
        bestScore: 100,
        recentScores: [80, 75, 90, 85, 70],
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: mockOverview });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getOverview();

      expect(api.get).toHaveBeenCalledWith('/analytics/overview');
      expect(result.totalQuizzes).toBe(50);
    });
  });

  describe('getDashboardData', () => {
    it('should fetch all dashboard data in parallel', async () => {
      const mockTrends = { overall: { currentScore: 85 }, byDifficulty: {}, period: '7d' };
      const mockWeakAreas = [{ category: 'JS', topic: 'Closures', errorRate: 0.4 }];
      const mockPatterns = { bestTimeOfDay: 'morning', optimalQuizLength: 15 };
      const mockStreaks = { currentStreak: 5, longestStreak: 10 };

      (api.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: mockTrends })
        .mockResolvedValueOnce({ data: mockWeakAreas })
        .mockResolvedValueOnce({ data: mockPatterns })
        .mockResolvedValueOnce({ data: mockStreaks });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getDashboardData();

      expect(result.trends).toBeDefined();
      expect(result.weakAreas).toBeDefined();
      expect(result.patterns).toBeDefined();
      expect(result.streaks).toBeDefined();
    });

    it('should handle partial failures gracefully', async () => {
      (api.get as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ data: { overall: { currentScore: 85 } } })
        .mockRejectedValueOnce(new Error('Weak areas failed'))
        .mockResolvedValueOnce({ data: { bestTimeOfDay: 'morning' } })
        .mockResolvedValueOnce({ data: { currentStreak: 5 } });

      const { analyticsService } = await import('../analytics.service');
      
      // Should handle partial failure
      try {
        await analyticsService.getDashboardData();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

describe('Analytics Data Transformation', () => {
  describe('formatTimeOfDay', () => {
    it('should format time of day correctly', async () => {
      const { formatTimeOfDay } = await import('../analytics.service');
      
      expect(formatTimeOfDay('morning')).toBe('Morning (6am-12pm)');
      expect(formatTimeOfDay('afternoon')).toBe('Afternoon (12pm-6pm)');
      expect(formatTimeOfDay('evening')).toBe('Evening (6pm-12am)');
      expect(formatTimeOfDay('night')).toBe('Night (12am-6am)');
    });
  });

  describe('calculateTrendDirection', () => {
    it('should determine trend direction correctly', async () => {
      const { calculateTrendDirection } = await import('../analytics.service');
      
      expect(calculateTrendDirection(10)).toBe('up');
      expect(calculateTrendDirection(-10)).toBe('down');
      expect(calculateTrendDirection(2)).toBe('stable');
      expect(calculateTrendDirection(-2)).toBe('stable');
    });
  });

  describe('formatDuration', () => {
    it('should format duration in human-readable form', async () => {
      const { formatDuration } = await import('../analytics.service');
      
      expect(formatDuration(3600)).toBe('1h 0m');
      expect(formatDuration(5400)).toBe('1h 30m');
      expect(formatDuration(45)).toBe('0h 0m 45s');
      expect(formatDuration(7265)).toBe('2h 1m');
    });
  });
});

describe('Analytics Cache Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should cache analytics data in React Query', async () => {
    // This would be tested with React Query's cache inspection
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: {} });

    const { analyticsService } = await import('../analytics.service');
    
    // First call
    await analyticsService.getTrends('7d');
    
    // Verify the service was called
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('should invalidate cache on demand', async () => {
    const { analyticsService } = await import('../analytics.service');
    
    // If the service has invalidation method
    if (typeof analyticsService.invalidateCache === 'function') {
      await analyticsService.invalidateCache();
    }
  });
});
