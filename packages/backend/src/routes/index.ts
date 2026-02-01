/**
 * API Routes index
 * Combines all route modules
 */
import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { pdfRoutes } from './pdf.routes';
import { questionRoutes } from './questions.routes';
import { quizSessionRoutes } from './quiz-sessions.routes';
import { analyticsRoutes } from './analytics.routes';
import { settingsRoutes } from './settings.routes';
import { authController } from '../controllers';
import { apiRateLimiter } from '../middleware';

const router = Router();

// Apply API rate limiter to all routes
router.use(apiRateLimiter);

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     tags:
 *       - System
 *     summary: Health check
 *     description: Returns the health status of the API
 *     responses:
 *       200:
 *         description: API is healthy
 */
router.get('/health', authController.healthCheck);

// Mount route modules
router.use('/auth', authRoutes);
router.use('/pdfs', pdfRoutes);
router.use('/questions', questionRoutes);
router.use('/quiz-sessions', quizSessionRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);

export { router as apiRoutes };
