/**
 * Advanced Analytics Service
 * Comprehensive learning analytics, insights, and performance tracking
 */
import { db } from '../db';
import { redis } from '../config/redis';
import { quizSessions } from '../db/schema/quiz-sessions';
import { userAnswers } from '../db/schema/user-answers';
import { questions } from '../db/schema/questions';
import { pdfs } from '../db/schema/pdfs';
import { eq, and, sql, desc, gte, lte, count, avg, sum } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { subDays, startOfDay, format, getHours } from 'date-fns';

/**
 * Cache TTL values (in seconds)
 */
const CACHE_TTL = {
  TRENDS: 300, // 5 minutes
  WEAK_AREAS: 300,
  PATTERNS: 600, // 10 minutes
  STREAKS: 60, // 1 minute (changes frequently)
};

/**
 * Daily score data point
 */
export interface DailyScore {
  date: string;
  avgScore: number;
  quizzes: number;
  totalQuestions: number;
  correctAnswers: number;
}

/**
 * Performance by difficulty
 */
export interface DifficultyPerformance {
  avgScore: number;
  totalQuestions: number;
  correctAnswers: number;
  quizzes: number;
}

/**
 * Trends response
 */
export interface TrendsData {
  dailyScores: DailyScore[];
  byDifficulty: {
    easy: DifficultyPerformance;
    medium: DifficultyPerformance;
    hard: DifficultyPerformance;
  };
  overallTrend: 'improving' | 'stable' | 'declining';
  improvementRate: number; // % change per week
}

/**
 * Weak question with accuracy
 */
export interface WeakQuestion {
  questionId: string;
  questionText: string;
  pdfFilename: string;
  pdfId: string;
  difficulty: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

/**
 * Weak areas response
 */
export interface WeakAreasData {
  weakQuestions: WeakQuestion[];
  weakDifficulties: string[];
  recommendedPdfs: Array<{
    pdfId: string;
    filename: string;
    weakQuestionCount: number;
    avgAccuracy: number;
  }>;
  totalWeakAreas: number;
}

/**
 * Learning patterns
 */
export interface PatternsData {
  bestTimeOfDay: {
    hour: number;
    avgScore: number;
    quizCount: number;
  } | null;
  optimalQuizLength: {
    questionCount: number;
    avgScore: number;
    quizCount: number;
  } | null;
  retention: {
    pdfRetakeRate: number;
    avgImprovementOnRetake: number;
  };
  avgTimePerQuestion: number;
  fastestCompletionTime: number;
}

/**
 * Streak and gamification data
 */
export interface StreaksData {
  currentStreak: number;
  longestStreak: number;
  totalQuizzes: number;
  totalQuestionsAnswered: number;
  lastActivityDate: string | null;
  streakDates: string[]; // Last 90 days activity
  milestones: {
    quizzes: { current: number; next: number; progress: number };
    questions: { current: number; next: number; progress: number };
    streak: { current: number; next: number; progress: number };
  };
}

/**
 * Cache key generators
 */
const cacheKeys = {
  trends: (userId: string) => `analytics:trends:${userId}`,
  weakAreas: (userId: string) => `analytics:weak_areas:${userId}`,
  patterns: (userId: string) => `analytics:patterns:${userId}`,
  streaks: (userId: string) => `analytics:streaks:${userId}`,
};

class AdvancedAnalyticsService {
  /**
   * Get performance trends (last 30 days)
   */
  async getTrends(userId: string, useCache = true): Promise<TrendsData> {
    const cacheKey = cacheKeys.trends(userId);

    if (useCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Trends cache hit', { userId });
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Trends cache read failed', { error });
      }
    }

    const thirtyDaysAgo = subDays(new Date(), 30);

    // Get daily scores
    const dailyResults = await db
      .select({
        date: sql<string>`DATE(${quizSessions.completedAt})`,
        avgScore: sql<number>`AVG(${quizSessions.scorePercentage})::float`,
        quizzes: count(),
        totalQuestions: sum(quizSessions.totalQuestions),
        correctAnswers: sum(quizSessions.correctAnswers),
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed'),
          gte(quizSessions.completedAt, thirtyDaysAgo)
        )
      )
      .groupBy(sql`DATE(${quizSessions.completedAt})`)
      .orderBy(sql`DATE(${quizSessions.completedAt})`);

    // Get performance by difficulty
    const difficultyResults = await db
      .select({
        difficulty: quizSessions.difficultyFilter,
        avgScore: sql<number>`AVG(${quizSessions.scorePercentage})::float`,
        totalQuestions: sum(quizSessions.totalQuestions),
        correctAnswers: sum(quizSessions.correctAnswers),
        quizzes: count(),
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed'),
          gte(quizSessions.completedAt, thirtyDaysAgo)
        )
      )
      .groupBy(quizSessions.difficultyFilter);

    // Process daily scores
    const dailyScores: DailyScore[] = dailyResults.map((row) => ({
      date: row.date,
      avgScore: Math.round((row.avgScore || 0) * 100) / 100,
      quizzes: Number(row.quizzes),
      totalQuestions: Number(row.totalQuestions) || 0,
      correctAnswers: Number(row.correctAnswers) || 0,
    }));

    // Process difficulty data
    const byDifficulty = {
      easy: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
      medium: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
      hard: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
    };

    for (const row of difficultyResults) {
      const diff = row.difficulty as 'easy' | 'medium' | 'hard';
      if (diff && byDifficulty[diff]) {
        byDifficulty[diff] = {
          avgScore: Math.round((row.avgScore || 0) * 100) / 100,
          totalQuestions: Number(row.totalQuestions) || 0,
          correctAnswers: Number(row.correctAnswers) || 0,
          quizzes: Number(row.quizzes),
        };
      }
    }

    // Calculate trend
    const { overallTrend, improvementRate } = this.calculateTrend(dailyScores);

    const trends: TrendsData = {
      dailyScores,
      byDifficulty,
      overallTrend,
      improvementRate,
    };

    // Cache result
    try {
      await redis.setex(cacheKey, CACHE_TTL.TRENDS, JSON.stringify(trends));
    } catch (error) {
      logger.warn('Trends cache write failed', { error });
    }

    return trends;
  }

  /**
   * Calculate overall trend from daily scores
   */
  private calculateTrend(dailyScores: DailyScore[]): { overallTrend: 'improving' | 'stable' | 'declining'; improvementRate: number } {
    if (dailyScores.length < 7) {
      return { overallTrend: 'stable', improvementRate: 0 };
    }

    // Compare first week avg to last week avg
    const sortedScores = [...dailyScores].sort((a, b) => a.date.localeCompare(b.date));
    const firstWeek = sortedScores.slice(0, Math.min(7, Math.floor(sortedScores.length / 2)));
    const lastWeek = sortedScores.slice(-Math.min(7, Math.ceil(sortedScores.length / 2)));

    const firstWeekAvg = firstWeek.reduce((sum, d) => sum + d.avgScore, 0) / firstWeek.length;
    const lastWeekAvg = lastWeek.reduce((sum, d) => sum + d.avgScore, 0) / lastWeek.length;

    const improvementRate = firstWeekAvg > 0 
      ? Math.round(((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 10000) / 100
      : 0;

    let overallTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (improvementRate > 5) overallTrend = 'improving';
    else if (improvementRate < -5) overallTrend = 'declining';

    return { overallTrend, improvementRate };
  }

  /**
   * Get weak areas (questions with low accuracy)
   */
  async getWeakAreas(userId: string, useCache = true): Promise<WeakAreasData> {
    const cacheKey = cacheKeys.weakAreas(userId);

    if (useCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Weak areas cache hit', { userId });
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Weak areas cache read failed', { error });
      }
    }

    // Get questions user has answered with accuracy < 70%
    const weakQuestionsResults = await db
      .select({
        questionId: userAnswers.questionId,
        questionText: questions.questionText,
        difficulty: questions.difficulty,
        pdfId: questions.pdfId,
        pdfFilename: pdfs.filename,
        attempts: count(),
        correct: sql<number>`SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::int`,
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .innerJoin(questions, eq(userAnswers.questionId, questions.id))
      .innerJoin(pdfs, eq(questions.pdfId, pdfs.id))
      .where(eq(quizSessions.userId, userId))
      .groupBy(
        userAnswers.questionId,
        questions.questionText,
        questions.difficulty,
        questions.pdfId,
        pdfs.filename
      )
      .having(
        sql`COUNT(*) >= 2 AND (SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*)) < 0.7`
      )
      .orderBy(sql`(SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*))`)
      .limit(20);

    const weakQuestions: WeakQuestion[] = weakQuestionsResults.map((row) => ({
      questionId: row.questionId,
      questionText: row.questionText.substring(0, 200) + (row.questionText.length > 200 ? '...' : ''),
      pdfFilename: row.pdfFilename,
      pdfId: row.pdfId,
      difficulty: row.difficulty,
      attempts: Number(row.attempts),
      correct: row.correct,
      accuracy: Math.round((row.correct / Number(row.attempts)) * 100),
    }));

    // Identify weak difficulties (< 60% accuracy)
    const difficultyAccuracy = await db
      .select({
        difficulty: questions.difficulty,
        accuracy: sql<number>`(SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*) * 100)`,
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .innerJoin(questions, eq(userAnswers.questionId, questions.id))
      .where(eq(quizSessions.userId, userId))
      .groupBy(questions.difficulty);

    const weakDifficulties = difficultyAccuracy
      .filter((row) => row.accuracy < 60)
      .map((row) => row.difficulty);

    // Recommend PDFs with most weak questions
    const recommendedPdfs = await db
      .select({
        pdfId: pdfs.id,
        filename: pdfs.filename,
        weakQuestionCount: sql<number>`COUNT(DISTINCT ${userAnswers.questionId})::int`,
        avgAccuracy: sql<number>`(SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*) * 100)`,
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .innerJoin(questions, eq(userAnswers.questionId, questions.id))
      .innerJoin(pdfs, eq(questions.pdfId, pdfs.id))
      .where(eq(quizSessions.userId, userId))
      .groupBy(pdfs.id, pdfs.filename)
      .having(sql`(SUM(CASE WHEN ${userAnswers.isCorrect} THEN 1 ELSE 0 END)::float / COUNT(*)) < 0.7`)
      .orderBy(desc(sql`COUNT(DISTINCT ${userAnswers.questionId})`))
      .limit(5);

    const result: WeakAreasData = {
      weakQuestions,
      weakDifficulties,
      recommendedPdfs: recommendedPdfs.map((r) => ({
        pdfId: r.pdfId,
        filename: r.filename,
        weakQuestionCount: r.weakQuestionCount,
        avgAccuracy: Math.round(r.avgAccuracy * 100) / 100,
      })),
      totalWeakAreas: weakQuestions.length,
    };

    // Cache result
    try {
      await redis.setex(cacheKey, CACHE_TTL.WEAK_AREAS, JSON.stringify(result));
    } catch (error) {
      logger.warn('Weak areas cache write failed', { error });
    }

    return result;
  }

  /**
   * Get learning patterns
   */
  async getPatterns(userId: string, useCache = true): Promise<PatternsData> {
    const cacheKey = cacheKeys.patterns(userId);

    if (useCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Patterns cache hit', { userId });
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Patterns cache read failed', { error });
      }
    }

    // Best time of day analysis
    const timeOfDayResults = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${quizSessions.startedAt})::int`,
        avgScore: sql<number>`AVG(${quizSessions.scorePercentage})::float`,
        quizCount: count(),
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${quizSessions.startedAt})`)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(desc(sql`AVG(${quizSessions.scorePercentage})`))
      .limit(1);

    const bestTimeOfDay = timeOfDayResults.length > 0
      ? {
          hour: timeOfDayResults[0].hour,
          avgScore: Math.round(timeOfDayResults[0].avgScore * 100) / 100,
          quizCount: Number(timeOfDayResults[0].quizCount),
        }
      : null;

    // Optimal quiz length
    const quizLengthResults = await db
      .select({
        questionCount: quizSessions.totalQuestions,
        avgScore: sql<number>`AVG(${quizSessions.scorePercentage})::float`,
        quizCount: count(),
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      )
      .groupBy(quizSessions.totalQuestions)
      .having(sql`COUNT(*) >= 3`)
      .orderBy(desc(sql`AVG(${quizSessions.scorePercentage})`))
      .limit(1);

    const optimalQuizLength = quizLengthResults.length > 0
      ? {
          questionCount: quizLengthResults[0].questionCount,
          avgScore: Math.round(quizLengthResults[0].avgScore * 100) / 100,
          quizCount: Number(quizLengthResults[0].quizCount),
        }
      : null;

    // Retention analysis (retake improvement)
    const retakeResults = await db
      .select({
        pdfId: quizSessions.pdfId,
        sessionCount: count(),
        firstScore: sql<number>`MIN(${quizSessions.scorePercentage})::float`,
        lastScore: sql<number>`MAX(${quizSessions.scorePercentage})::float`,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      )
      .groupBy(quizSessions.pdfId)
      .having(sql`COUNT(*) >= 2`);

    const totalPdfsWithQuizzes = await db
      .selectDistinct({ pdfId: quizSessions.pdfId })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      );

    const pdfRetakeRate = totalPdfsWithQuizzes.length > 0
      ? retakeResults.length / totalPdfsWithQuizzes.length
      : 0;

    const avgImprovementOnRetake = retakeResults.length > 0
      ? retakeResults.reduce((sum, r) => sum + (r.lastScore - r.firstScore), 0) / retakeResults.length
      : 0;

    // Average time per question
    const timeStats = await db
      .select({
        avgTime: sql<number>`AVG(${userAnswers.timeSpentSeconds})::float`,
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .where(eq(quizSessions.userId, userId));

    const avgTimePerQuestion = timeStats[0]?.avgTime || 0;

    // Fastest completion
    const fastestResults = await db
      .select({
        duration: sql<number>`EXTRACT(EPOCH FROM (${quizSessions.completedAt} - ${quizSessions.startedAt}))::int`,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      )
      .orderBy(sql`${quizSessions.completedAt} - ${quizSessions.startedAt}`)
      .limit(1);

    const fastestCompletionTime = fastestResults[0]?.duration || 0;

    const patterns: PatternsData = {
      bestTimeOfDay,
      optimalQuizLength,
      retention: {
        pdfRetakeRate: Math.round(pdfRetakeRate * 100) / 100,
        avgImprovementOnRetake: Math.round(avgImprovementOnRetake * 100) / 100,
      },
      avgTimePerQuestion: Math.round(avgTimePerQuestion * 10) / 10,
      fastestCompletionTime,
    };

    // Cache result
    try {
      await redis.setex(cacheKey, CACHE_TTL.PATTERNS, JSON.stringify(patterns));
    } catch (error) {
      logger.warn('Patterns cache write failed', { error });
    }

    return patterns;
  }

  /**
   * Get streaks and gamification data
   */
  async getStreaks(userId: string, useCache = true): Promise<StreaksData> {
    const cacheKey = cacheKeys.streaks(userId);

    if (useCache) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          logger.debug('Streaks cache hit', { userId });
          return JSON.parse(cached);
        }
      } catch (error) {
        logger.warn('Streaks cache read failed', { error });
      }
    }

    // Get activity dates (last 90 days)
    const ninetyDaysAgo = subDays(new Date(), 90);
    const activityDates = await db
      .selectDistinct({
        date: sql<string>`DATE(${quizSessions.completedAt})`,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed'),
          gte(quizSessions.completedAt, ninetyDaysAgo)
        )
      )
      .orderBy(desc(sql`DATE(${quizSessions.completedAt})`));

    const dates = activityDates.map((d) => d.date);

    // Calculate current streak
    let currentStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Check if active today or yesterday to start streak count
    if (dates.includes(today) || dates.includes(yesterday)) {
      let checkDate = dates.includes(today) ? new Date() : subDays(new Date(), 1);
      while (dates.includes(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      }
    }

    // Calculate longest streak from all activity
    const allActivityDates = await db
      .selectDistinct({
        date: sql<string>`DATE(${quizSessions.completedAt})`,
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      )
      .orderBy(sql`DATE(${quizSessions.completedAt})`);

    const allDates = allActivityDates.map((d) => d.date);
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;

    for (const dateStr of allDates) {
      const date = new Date(dateStr);
      if (prevDate) {
        const diffDays = Math.round((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      } else {
        tempStreak = 1;
      }
      prevDate = date;
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Total stats
    const totals = await db
      .select({
        totalQuizzes: count(),
      })
      .from(quizSessions)
      .where(
        and(
          eq(quizSessions.userId, userId),
          eq(quizSessions.status, 'completed')
        )
      );

    const questionsTotals = await db
      .select({
        totalAnswers: count(),
      })
      .from(userAnswers)
      .innerJoin(quizSessions, eq(userAnswers.quizSessionId, quizSessions.id))
      .where(eq(quizSessions.userId, userId));

    const totalQuizzes = Number(totals[0]?.totalQuizzes) || 0;
    const totalQuestionsAnswered = Number(questionsTotals[0]?.totalAnswers) || 0;

    // Milestones
    const quizMilestones = [10, 25, 50, 100, 250, 500, 1000];
    const questionMilestones = [100, 500, 1000, 2500, 5000, 10000];
    const streakMilestones = [7, 14, 30, 60, 100, 365];

    const getNextMilestone = (current: number, milestones: number[]) => {
      const next = milestones.find((m) => m > current) || milestones[milestones.length - 1];
      const prevMilestone = milestones.filter((m) => m <= current).pop() || 0;
      const progress = next > prevMilestone ? ((current - prevMilestone) / (next - prevMilestone)) * 100 : 100;
      return { current, next, progress: Math.min(100, Math.round(progress)) };
    };

    const streaks: StreaksData = {
      currentStreak,
      longestStreak,
      totalQuizzes,
      totalQuestionsAnswered,
      lastActivityDate: dates[0] || null,
      streakDates: dates,
      milestones: {
        quizzes: getNextMilestone(totalQuizzes, quizMilestones),
        questions: getNextMilestone(totalQuestionsAnswered, questionMilestones),
        streak: getNextMilestone(currentStreak, streakMilestones),
      },
    };

    // Cache result (short TTL since streaks change daily)
    try {
      await redis.setex(cacheKey, CACHE_TTL.STREAKS, JSON.stringify(streaks));
    } catch (error) {
      logger.warn('Streaks cache write failed', { error });
    }

    return streaks;
  }

  /**
   * Invalidate all analytics caches for a user
   */
  async invalidateUserCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        redis.del(cacheKeys.trends(userId)),
        redis.del(cacheKeys.weakAreas(userId)),
        redis.del(cacheKeys.patterns(userId)),
        redis.del(cacheKeys.streaks(userId)),
      ]);
      logger.debug('Advanced analytics cache invalidated', { userId });
    } catch (error) {
      logger.warn('Cache invalidation failed', { error });
    }
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
