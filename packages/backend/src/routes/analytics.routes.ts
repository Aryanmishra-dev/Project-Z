/**
 * Analytics Routes
 * User statistics, dashboard data, and advanced analytics
 */
import { Router } from 'express';
import {
  authenticate,
  authorize,
  asyncHandler,
} from '../middleware';
import { analyticsService } from '../services/analytics.service';
import { advancedAnalyticsService } from '../services/advanced-analytics.service';
import { AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /api/v1/analytics/dashboard:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get user dashboard statistics
 *     description: Get aggregated statistics for the user's dashboard
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: refresh
 *         in: query
 *         description: Force refresh, bypassing cache
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     pdfs:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         completed: { type: integer }
 *                         pending: { type: integer }
 *                         failed: { type: integer }
 *                         totalQuestions: { type: integer }
 *                     quizzes:
 *                       type: object
 *                       properties:
 *                         total: { type: integer }
 *                         completed: { type: integer }
 *                         averageScore: { type: number }
 *                         totalQuestionsAnswered: { type: integer }
 *                         correctAnswers: { type: integer }
 *                         accuracy: { type: number }
 *                     recentActivity:
 *                       type: object
 *                       properties:
 *                         lastQuizDate: { type: string }
 *                         lastUploadDate: { type: string }
 *                         quizzesThisWeek: { type: integer }
 */
router.get(
  '/dashboard',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const refresh = req.query.refresh === 'true';

    const stats = await analyticsService.getUserDashboard(userId, !refresh);

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/queue:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get queue statistics
 *     description: Get current PDF processing queue statistics (admin only)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Queue statistics
 *       403:
 *         description: Admin access required
 */
router.get(
  '/queue',
  authorize('admin'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const stats = await analyticsService.getQueueStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/health:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get system health status
 *     description: Get health status of all system components
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System health status
 */
router.get(
  '/health',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const health = await analyticsService.getSystemHealth();

    const allHealthy = Object.values(health).every((v) => v === true);

    res.json({
      success: true,
      data: {
        status: allHealthy ? 'healthy' : 'degraded',
        components: health,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/invalidate-cache:
 *   post:
 *     tags:
 *       - Analytics
 *     summary: Invalidate user's analytics cache
 *     description: Force invalidation of the user's cached analytics data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache invalidated
 */
router.post(
  '/invalidate-cache',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;

    await analyticsService.invalidateUserCache(userId);
    await advancedAnalyticsService.invalidateUserCache(userId);

    res.json({
      success: true,
      message: 'Analytics cache invalidated',
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/trends:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get performance trends
 *     description: Get user's performance trends over the last 30 days
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: refresh
 *         in: query
 *         description: Force refresh, bypassing cache
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Performance trends data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     dailyScores:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date: { type: string }
 *                           avgScore: { type: number }
 *                           quizzes: { type: integer }
 *                     byDifficulty:
 *                       type: object
 *                       properties:
 *                         easy: { type: object }
 *                         medium: { type: object }
 *                         hard: { type: object }
 *                     overallTrend: { type: string }
 *                     improvementRate: { type: number }
 */
router.get(
  '/trends',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const refresh = req.query.refresh === 'true';

    const trends = await advancedAnalyticsService.getTrends(userId, !refresh);

    res.json({
      success: true,
      data: trends,
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/weak-areas:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get weak areas analysis
 *     description: Get questions and topics where user struggles
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: refresh
 *         in: query
 *         description: Force refresh, bypassing cache
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Weak areas data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     weakQuestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     weakDifficulties:
 *                       type: array
 *                       items:
 *                         type: string
 *                     recommendedPdfs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     totalWeakAreas: { type: integer }
 */
router.get(
  '/weak-areas',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const refresh = req.query.refresh === 'true';

    const weakAreas = await advancedAnalyticsService.getWeakAreas(userId, !refresh);

    res.json({
      success: true,
      data: weakAreas,
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/patterns:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get learning patterns
 *     description: Get user's learning patterns and optimal study times
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: refresh
 *         in: query
 *         description: Force refresh, bypassing cache
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Learning patterns data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     bestTimeOfDay: { type: object }
 *                     optimalQuizLength: { type: object }
 *                     retention: { type: object }
 *                     avgTimePerQuestion: { type: number }
 *                     fastestCompletionTime: { type: number }
 */
router.get(
  '/patterns',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const refresh = req.query.refresh === 'true';

    const patterns = await advancedAnalyticsService.getPatterns(userId, !refresh);

    res.json({
      success: true,
      data: patterns,
    });
  })
);

/**
 * @swagger
 * /api/v1/analytics/streaks:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get streak and gamification data
 *     description: Get user's current streak, milestones, and activity calendar
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: refresh
 *         in: query
 *         description: Force refresh, bypassing cache
 *         schema:
 *           type: boolean
 *           default: false
 *     responses:
 *       200:
 *         description: Streaks and gamification data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     currentStreak: { type: integer }
 *                     longestStreak: { type: integer }
 *                     totalQuizzes: { type: integer }
 *                     totalQuestionsAnswered: { type: integer }
 *                     lastActivityDate: { type: string }
 *                     streakDates: { type: array }
 *                     milestones: { type: object }
 */
router.get(
  '/streaks',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const refresh = req.query.refresh === 'true';

    const streaks = await advancedAnalyticsService.getStreaks(userId, !refresh);

    res.json({
      success: true,
      data: streaks,
    });
  })
);

export { router as analyticsRoutes };
