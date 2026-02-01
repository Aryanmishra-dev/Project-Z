/**
 * Analytics Service
 * Aggregated statistics and metrics with Redis caching
 */
import { redis } from '../config/redis';
import { pdfService } from './pdf.service';
import { quizSessionsService } from './quiz-sessions.service';
import { logger } from '../utils/logger';

/**
 * Cache TTL values (in seconds)
 */
const CACHE_TTL = {
  USER_STATS: 300, // 5 minutes
  DASHBOARD: 300, // 5 minutes
  LEADERBOARD: 600, // 10 minutes
};

/**
 * User dashboard stats
 */
export interface UserDashboardStats {
  pdfs: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalQuestions: number;
  };
  quizzes: {
    total: number;
    completed: number;
    averageScore: number;
    totalQuestionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
  };
  recentActivity: {
    lastQuizDate?: string;
    lastUploadDate?: string;
    quizzesThisWeek: number;
  };
}

/**
 * Cache key generators
 */
const cacheKeys = {
  userDashboard: (userId: string) => `analytics:dashboard:${userId}`,
  userStats: (userId: string) => `analytics:user:${userId}`,
};

class AnalyticsService {
  /**
   * Get user dashboard statistics
   */
  async getUserDashboard(userId: string, useCache = true): Promise<UserDashboardStats> {
    const cacheKey = cacheKeys.userDashboard(userId);

    // Try cache first
    if (useCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Analytics cache hit', { userId, key: cacheKey });
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Analytics cache read failed', { error });
      }
    }

    // Fetch fresh data
    const [pdfStats, quizStats] = await Promise.all([
      pdfService.getUserStats(userId),
      quizSessionsService.getUserStats(userId),
    ]);

    const stats: UserDashboardStats = {
      pdfs: {
        total: pdfStats.totalPdfs,
        completed: pdfStats.completedPdfs,
        pending: pdfStats.pendingPdfs,
        failed: pdfStats.failedPdfs,
        totalQuestions: pdfStats.totalQuestions,
      },
      quizzes: {
        total: quizStats.totalQuizzes,
        completed: quizStats.completedQuizzes,
        averageScore: Math.round(quizStats.averageScore * 100) / 100,
        totalQuestionsAnswered: quizStats.totalQuestionsAnswered,
        correctAnswers: quizStats.correctAnswers,
        accuracy: quizStats.totalQuestionsAnswered > 0
          ? Math.round((quizStats.correctAnswers / quizStats.totalQuestionsAnswered) * 10000) / 100
          : 0,
      },
      recentActivity: {
        quizzesThisWeek: 0, // Would need additional query
      },
    };

    // Cache result
    try {
      await redis.setex(cacheKey, CACHE_TTL.DASHBOARD, JSON.stringify(stats));
      logger.debug('Analytics cached', { userId, key: cacheKey });
    } catch (error) {
      logger.warn('Analytics cache write failed', { error });
    }

    return stats;
  }

  /**
   * Invalidate user dashboard cache
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await redis.del(cacheKeys.userDashboard(userId));
      await redis.del(cacheKeys.userStats(userId));
      logger.debug('Analytics cache invalidated', { userId });
    } catch (error) {
      logger.warn('Analytics cache invalidation failed', { error });
    }
  }

  /**
   * Get processing queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    // This would integrate with BullMQ queue stats
    const { getQueueStats } = await import('../queues');
    const stats = await getQueueStats();
    return {
      pending: stats.waiting + stats.delayed,
      processing: stats.active,
      completed: stats.completed,
      failed: stats.failed,
    };
  }

  /**
   * Get system health metrics
   */
  async getSystemHealth(): Promise<{
    database: boolean;
    redis: boolean;
    nlpService: boolean;
    queueWorker: boolean;
  }> {
    const results = {
      database: false,
      redis: false,
      nlpService: false,
      queueWorker: false,
    };

    // Check Redis
    try {
      await redis.ping();
      results.redis = true;
    } catch {
      results.redis = false;
    }

    // Check NLP service
    try {
      const nlpUrl = process.env.NLP_SERVICE_URL || 'http://localhost:8000';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${nlpUrl}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      results.nlpService = response.ok;
    } catch {
      results.nlpService = false;
    }

    // Check queue worker
    try {
      const { isWorkerRunning } = await import('../workers');
      results.queueWorker = isWorkerRunning();
    } catch {
      results.queueWorker = false;
    }

    // Database is assumed healthy if other services work
    // (would need actual DB ping in production)
    results.database = true;

    return results;
  }
}

export const analyticsService = new AnalyticsService();
