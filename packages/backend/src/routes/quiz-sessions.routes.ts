/**
 * Quiz Sessions Routes
 * Handles quiz session creation, management, and completion
 */
import { Router } from 'express';
import { z } from 'zod';

import { authenticate, validate, checkQuizSessionOwnership, asyncHandler } from '../middleware';
import { AuthenticatedRequest } from '../middleware/auth';
import { quizSessionsService } from '../services/quiz-sessions.service';
import { NotFoundError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Request schemas
 */
const createSessionSchema = z.object({
  body: z.object({
    pdfId: z.string().uuid(),
    questionCount: z.number().int().min(1).max(50).default(10),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  }),
});

const sessionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const submitAnswerSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    questionId: z.string().uuid(),
    selectedOption: z.enum(['A', 'B', 'C', 'D']),
    timeSpentSeconds: z.number().int().min(0).optional(),
    confidenceLevel: z.enum(['very_low', 'low', 'medium', 'high', 'very_high']).optional(),
  }),
});

const listSessionsSchema = z.object({
  query: z.object({
    pdfId: z.string().uuid().optional(),
    status: z.enum(['in_progress', 'completed', 'abandoned', 'timed_out']).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
  }),
});

/**
 * @swagger
 * /api/v1/quiz-sessions:
 *   post:
 *     tags:
 *       - Quiz Sessions
 *     summary: Start a new quiz session
 *     description: Create a new quiz session with random questions from a PDF
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pdfId:
 *                 type: string
 *                 format: uuid
 *               questionCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 50
 *                 default: 10
 *               difficulty:
 *                 type: string
 *                 enum: [easy, medium, hard]
 *             required:
 *               - pdfId
 *     responses:
 *       201:
 *         description: Quiz session created
 *       400:
 *         description: Validation error
 *       404:
 *         description: PDF not found
 */
router.post(
  '/',
  validate(createSessionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { pdfId, questionCount, difficulty } = req.body;

    const result = await quizSessionsService.create({
      userId,
      pdfId,
      questionCount,
      difficulty,
    });

    logger.info('Quiz session started', {
      sessionId: result.session.id,
      userId,
      pdfId,
      questionCount: result.questions.length,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions:
 *   get:
 *     tags:
 *       - Quiz Sessions
 *     summary: List user's quiz sessions
 *     description: Get a paginated list of the user's quiz sessions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pdfId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [in_progress, completed, abandoned, timed_out]
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: List of quiz sessions
 */
router.get(
  '/',
  validate(listSessionsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { pdfId, status, limit, offset } = req.query as z.infer<
      typeof listSessionsSchema
    >['query'];

    const result = await quizSessionsService.list({
      userId,
      pdfId,
      status,
      limit,
      offset,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions/{id}:
 *   get:
 *     tags:
 *       - Quiz Sessions
 *     summary: Get quiz session details
 *     description: Get detailed information about a specific quiz session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Quiz session details
 *       403:
 *         description: Not owner of the session
 *       404:
 *         description: Session not found
 */
router.get(
  '/:id',
  validate(sessionIdSchema),
  checkQuizSessionOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const session = await quizSessionsService.getWithDetails(id);
    if (!session) {
      throw new NotFoundError('Quiz session not found');
    }

    res.json({
      success: true,
      data: session,
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions/{id}/answers:
 *   post:
 *     tags:
 *       - Quiz Sessions
 *     summary: Submit an answer
 *     description: Submit an answer to a question in the quiz session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               questionId:
 *                 type: string
 *                 format: uuid
 *               selectedOption:
 *                 type: string
 *                 enum: [A, B, C, D]
 *               timeSpentSeconds:
 *                 type: integer
 *                 minimum: 0
 *               confidenceLevel:
 *                 type: string
 *                 enum: [very_low, low, medium, high, very_high]
 *             required:
 *               - questionId
 *               - selectedOption
 *     responses:
 *       200:
 *         description: Answer submitted with result
 *       400:
 *         description: Validation error or already answered
 */
router.post(
  '/:id/answers',
  validate(submitAnswerSchema),
  checkQuizSessionOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    const { questionId, selectedOption, timeSpentSeconds, confidenceLevel } = req.body;

    const result = await quizSessionsService.submitAnswer(id, {
      questionId,
      selectedOption,
      timeSpentSeconds,
      confidenceLevel,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions/{id}/complete:
 *   post:
 *     tags:
 *       - Quiz Sessions
 *     summary: Complete a quiz session
 *     description: Mark the quiz session as completed and calculate final score
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session completed with results
 *       400:
 *         description: Session already completed
 */
router.post(
  '/:id/complete',
  validate(sessionIdSchema),
  checkQuizSessionOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const session = await quizSessionsService.complete(id);

    logger.info('Quiz session completed', {
      sessionId: id,
      score: session.scorePercentage,
    });

    res.json({
      success: true,
      data: session,
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions/{id}/abandon:
 *   post:
 *     tags:
 *       - Quiz Sessions
 *     summary: Abandon a quiz session
 *     description: Mark the quiz session as abandoned
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Session abandoned
 *       400:
 *         description: Session not in progress
 */
router.post(
  '/:id/abandon',
  validate(sessionIdSchema),
  checkQuizSessionOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const session = await quizSessionsService.abandon(id);

    res.json({
      success: true,
      data: session,
      message: 'Quiz session abandoned',
    });
  })
);

/**
 * @swagger
 * /api/v1/quiz-sessions/{id}/results:
 *   get:
 *     tags:
 *       - Quiz Sessions
 *     summary: Get quiz results
 *     description: Get detailed results for a completed quiz session
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Quiz results
 */
router.get(
  '/:id/results',
  validate(sessionIdSchema),
  checkQuizSessionOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const session = await quizSessionsService.getWithDetails(id);
    if (!session) {
      throw new NotFoundError('Quiz session not found');
    }

    // Calculate additional stats
    const totalTime = session.answers.reduce((sum, a) => sum + (a.timeSpentSeconds || 0), 0);
    const correctByDifficulty = {
      easy: { total: 0, correct: 0 },
      medium: { total: 0, correct: 0 },
      hard: { total: 0, correct: 0 },
    };

    for (const answer of session.answers) {
      const diff = answer.question.difficulty;
      correctByDifficulty[diff].total++;
      if (answer.isCorrect) {
        correctByDifficulty[diff].correct++;
      }
    }

    res.json({
      success: true,
      data: {
        session,
        summary: {
          totalQuestions: session.totalQuestions,
          answeredQuestions: session.answers.length,
          correctAnswers: session.correctAnswers,
          scorePercentage: session.scorePercentage,
          totalTimeSeconds: totalTime,
          averageTimePerQuestion:
            session.answers.length > 0 ? Math.round(totalTime / session.answers.length) : 0,
          byDifficulty: correctByDifficulty,
        },
      },
    });
  })
);

export { router as quizSessionRoutes };
