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

  describe('getDashboard', () => {
    it('should fetch dashboard data successfully', async () => {
      const mockDashboard = {
        pdfs: { total: 10, completed: 8, pending: 1, failed: 1, totalQuestions: 100 },
        quizzes: {
          total: 50,
          completed: 45,
          averageScore: 75,
          totalQuestionsAnswered: 500,
          correctAnswers: 375,
          accuracy: 75,
        },
        recentActivity: {
          lastQuizDate: '2024-01-05',
          lastUploadDate: '2024-01-04',
          quizzesThisWeek: 5,
        },
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockDashboard },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getDashboard();

      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/dashboard', {
        params: { refresh: false },
      });
      expect(result.pdfs.total).toBe(10);
      expect(result.quizzes.averageScore).toBe(75);
    });
  });

  describe('getTrends', () => {
    it('should fetch trends data successfully', async () => {
      const mockTrends = {
        dailyScores: [
          { date: '2024-01-01', avgScore: 70, quizzes: 3, totalQuestions: 30, correctAnswers: 21 },
          { date: '2024-01-02', avgScore: 80, quizzes: 2, totalQuestions: 20, correctAnswers: 16 },
        ],
        byDifficulty: {
          easy: { avgScore: 90, totalQuestions: 50, correctAnswers: 45, quizzes: 10 },
          medium: { avgScore: 75, totalQuestions: 40, correctAnswers: 30, quizzes: 8 },
          hard: { avgScore: 60, totalQuestions: 20, correctAnswers: 12, quizzes: 4 },
        },
        overallTrend: 'improving',
        improvementRate: 5.2,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockTrends },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getTrends();

      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/trends', {
        params: { refresh: false },
      });
      expect(result.overallTrend).toBe('improving');
      expect(result.byDifficulty.easy.avgScore).toBe(90);
    });

    it('should pass refresh parameter', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { success: true, data: {} },
      });

      const { analyticsService } = await import('../analytics.service');

      await analyticsService.getTrends(true);
      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/trends', {
        params: { refresh: true },
      });
    });

    it('should handle API errors', async () => {
      (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const { analyticsService } = await import('../analytics.service');

      await expect(analyticsService.getTrends()).rejects.toThrow('Network error');
    });
  });

  describe('getWeakAreas', () => {
    it('should fetch weak areas successfully', async () => {
      const mockWeakAreas = {
        weakQuestions: [
          {
            questionId: '1',
            questionText: 'What is a closure?',
            pdfFilename: 'javascript.pdf',
            pdfId: 'pdf-1',
            difficulty: 'hard',
            attempts: 5,
            correct: 1,
            accuracy: 20,
          },
        ],
        weakDifficulties: ['hard'],
        recommendedPdfs: [
          { pdfId: 'pdf-1', filename: 'javascript.pdf', weakQuestionCount: 3, avgAccuracy: 40 },
        ],
        totalWeakAreas: 5,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockWeakAreas },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getWeakAreas();

      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/weak-areas', {
        params: { refresh: false },
      });
      expect(result.weakQuestions).toHaveLength(1);
      expect(result.totalWeakAreas).toBe(5);
    });

    it('should return empty data for new users', async () => {
      const emptyData = {
        weakQuestions: [],
        weakDifficulties: [],
        recommendedPdfs: [],
        totalWeakAreas: 0,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: emptyData },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getWeakAreas();

      expect(result.weakQuestions).toEqual([]);
      expect(result.totalWeakAreas).toBe(0);
    });
  });

  describe('getPatterns', () => {
    it('should fetch learning patterns successfully', async () => {
      const mockPatterns = {
        bestTimeOfDay: { hour: 10, avgScore: 85, quizCount: 15 },
        optimalQuizLength: { questionCount: 15, avgScore: 80, quizCount: 10 },
        retention: { pdfRetakeRate: 0.3, avgImprovementOnRetake: 12 },
        avgTimePerQuestion: 45,
        fastestCompletionTime: 120,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockPatterns },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getPatterns();

      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/patterns', {
        params: { refresh: false },
      });
      expect(result.bestTimeOfDay?.hour).toBe(10);
      expect(result.avgTimePerQuestion).toBe(45);
    });

    it('should handle null values for new users', async () => {
      const mockPatterns = {
        bestTimeOfDay: null,
        optimalQuizLength: null,
        retention: { pdfRetakeRate: 0, avgImprovementOnRetake: 0 },
        avgTimePerQuestion: 0,
        fastestCompletionTime: 0,
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockPatterns },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getPatterns();

      expect(result.bestTimeOfDay).toBeNull();
      expect(result.optimalQuizLength).toBeNull();
    });
  });

  describe('getStreaks', () => {
    it('should fetch streak data successfully', async () => {
      const mockStreaks = {
        currentStreak: 7,
        longestStreak: 14,
        totalQuizzes: 50,
        totalQuestionsAnswered: 500,
        lastActivityDate: '2024-01-05',
        streakDates: ['2024-01-05', '2024-01-04', '2024-01-03'],
        milestones: {
          quizzes: { current: 50, next: 100, progress: 50 },
          questions: { current: 500, next: 1000, progress: 50 },
          streak: { current: 7, next: 14, progress: 50 },
        },
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockStreaks },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getStreaks();

      expect(api.get).toHaveBeenCalledWith('/api/v1/analytics/streaks', {
        params: { refresh: false },
      });
      expect(result.currentStreak).toBe(7);
      expect(result.milestones.quizzes.current).toBe(50);
    });

    it('should return zero streak for inactive users', async () => {
      const mockStreaks = {
        currentStreak: 0,
        longestStreak: 5,
        totalQuizzes: 10,
        totalQuestionsAnswered: 100,
        lastActivityDate: null,
        streakDates: [],
        milestones: {
          quizzes: { current: 10, next: 25, progress: 40 },
          questions: { current: 100, next: 250, progress: 40 },
          streak: { current: 0, next: 7, progress: 0 },
        },
      };

      (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { success: true, data: mockStreaks },
      });

      const { analyticsService } = await import('../analytics.service');
      const result = await analyticsService.getStreaks();

      expect(result.currentStreak).toBe(0);
      expect(result.lastActivityDate).toBeNull();
    });
  });

  describe('invalidateCache', () => {
    it('should call invalidate cache endpoint', async () => {
      (api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { success: true } });

      const { analyticsService } = await import('../analytics.service');
      await analyticsService.invalidateCache();

      expect(api.post).toHaveBeenCalledWith('/api/v1/analytics/invalidate-cache');
    });
  });
});

describe('Analytics Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle network errors gracefully', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

    const { analyticsService } = await import('../analytics.service');

    await expect(analyticsService.getDashboard()).rejects.toThrow('Network error');
  });

  it('should handle 401 unauthorized errors', async () => {
    const unauthorizedError = new Error('Unauthorized');
    (unauthorizedError as Error & { response?: { status: number } }).response = { status: 401 };
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(unauthorizedError);

    const { analyticsService } = await import('../analytics.service');

    await expect(analyticsService.getTrends()).rejects.toThrow('Unauthorized');
  });

  it('should handle 500 server errors', async () => {
    const serverError = new Error('Internal Server Error');
    (serverError as Error & { response?: { status: number } }).response = { status: 500 };
    (api.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(serverError);

    const { analyticsService } = await import('../analytics.service');

    await expect(analyticsService.getWeakAreas()).rejects.toThrow('Internal Server Error');
  });
});
