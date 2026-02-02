/**
 * Questions Routes
 * Handles question listing and retrieval
 */
import { Router } from 'express';
import { z } from 'zod';

import { authenticate, validate, checkPdfOwnership, asyncHandler } from '../middleware';
import { AuthenticatedRequest } from '../middleware/auth';
import { pdfService } from '../services/pdf.service';
import { questionsService } from '../services/questions.service';
import { NotFoundError, AuthorizationError } from '../utils/errors';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Request schemas
 */
const listQuestionsSchema = z.object({
  query: z.object({
    pdfId: z.string().uuid(),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    validationStatus: z.enum(['pending', 'valid', 'invalid', 'needs_review']).optional(),
    minQualityScore: z.coerce.number().min(0).max(1).optional(),
    limit: z.coerce.number().min(1).max(100).default(20),
    offset: z.coerce.number().min(0).default(0),
    sortBy: z.enum(['createdAt', 'difficulty', 'qualityScore']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const questionIdSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const randomQuestionsSchema = z.object({
  query: z.object({
    pdfId: z.string().uuid(),
    count: z.coerce.number().min(1).max(50).default(10),
    difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
    excludeIds: z.preprocess(
      (val) => (typeof val === 'string' && val ? val.split(',') : undefined),
      z.array(z.string().uuid()).optional()
    ),
    minQualityScore: z.coerce.number().min(0).max(1).default(0.5),
  }),
});

/**
 * Verify user owns the PDF associated with questions
 */
async function verifyPdfOwnership(pdfId: string, userId: string): Promise<void> {
  const pdf = await pdfService.getById(pdfId);
  if (!pdf) {
    throw new NotFoundError('PDF not found');
  }
  if (pdf.userId !== userId) {
    throw new AuthorizationError("Not authorized to access this PDF's questions");
  }
}

/**
 * @swagger
 * /api/v1/questions:
 *   get:
 *     tags:
 *       - Questions
 *     summary: List questions for a PDF
 *     description: Get a paginated list of questions for a specific PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pdfId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: difficulty
 *         in: query
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *       - name: validationStatus
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, valid, invalid, needs_review]
 *       - name: minQualityScore
 *         in: query
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [createdAt, difficulty, qualityScore]
 *           default: createdAt
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of questions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     questions:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Question'
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     hasMore: { type: boolean }
 */
router.get(
  '/',
  validate(listQuestionsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const {
      pdfId,
      difficulty,
      validationStatus,
      minQualityScore,
      limit,
      offset,
      sortBy,
      sortOrder,
    } = req.query as z.infer<typeof listQuestionsSchema>['query'];

    // Verify ownership
    await verifyPdfOwnership(pdfId, userId);

    const result = await questionsService.list({
      pdfId,
      difficulty,
      validationStatus,
      minQualityScore,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    res.json({
      success: true,
      data: result,
    });
  })
);

/**
 * @swagger
 * /api/v1/questions/random:
 *   get:
 *     tags:
 *       - Questions
 *     summary: Get random questions for a quiz
 *     description: Get random questions from a PDF for starting a quiz
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pdfId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: count
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *       - name: difficulty
 *         in: query
 *         schema:
 *           type: string
 *           enum: [easy, medium, hard]
 *       - name: excludeIds
 *         in: query
 *         description: Comma-separated list of question IDs to exclude
 *         schema:
 *           type: string
 *       - name: minQualityScore
 *         in: query
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.5
 *     responses:
 *       200:
 *         description: Random questions
 */
router.get(
  '/random',
  validate(randomQuestionsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { pdfId, count, difficulty, excludeIds, minQualityScore } = req.query as z.infer<
      typeof randomQuestionsSchema
    >['query'];

    // Verify ownership
    await verifyPdfOwnership(pdfId, userId);

    const questions = await questionsService.getRandomQuestions({
      pdfId,
      count,
      difficulty,
      excludeIds,
      minQualityScore,
    });

    res.json({
      success: true,
      data: {
        questions,
        count: questions.length,
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/questions/counts:
 *   get:
 *     tags:
 *       - Questions
 *     summary: Get question counts by difficulty
 *     description: Get the count of valid questions by difficulty level for a PDF
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: pdfId
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Question counts
 */
router.get(
  '/counts',
  validate(z.object({ query: z.object({ pdfId: z.string().uuid() }) })),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { pdfId } = req.query as { pdfId: string };

    // Verify ownership
    await verifyPdfOwnership(pdfId, userId);

    const counts = await questionsService.getCountsByDifficulty(pdfId);
    const total = await questionsService.getCountByPdfId(pdfId);

    res.json({
      success: true,
      data: {
        total,
        byDifficulty: counts,
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/questions/{id}:
 *   get:
 *     tags:
 *       - Questions
 *     summary: Get a specific question
 *     description: Get detailed information about a specific question
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
 *         description: Question details
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Question not found
 */
router.get(
  '/:id',
  validate(questionIdSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { id } = req.params;

    const question = await questionsService.getById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }

    // Verify user owns the PDF this question belongs to
    const isOwner = await questionsService.verifyOwnership(id, userId);
    if (!isOwner) {
      throw new AuthorizationError('Not authorized to access this question');
    }

    res.json({
      success: true,
      data: question,
    });
  })
);

export { router as questionRoutes };
