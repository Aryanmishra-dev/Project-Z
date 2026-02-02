/**
 * PDF Routes
 * Handles PDF upload, listing, viewing, and deletion
 */
import fs from 'fs';
import path from 'path';

import { Router } from 'express';
import { z } from 'zod';

import {
  authenticate,
  validate,
  pdfUpload,
  validatePdfContent,
  checkPdfOwnership,
  asyncHandler,
  sanitizeFilename,
} from '../middleware';
import { AuthenticatedRequest } from '../middleware/auth';
import { addPdfProcessingJob, getJobStatus, cancelJob } from '../queues';
import { pdfService } from '../services/pdf.service';
import { questionsService } from '../services/questions.service';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Request schemas
 */
const listPdfsQuerySchema = z.object({
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  page: z.coerce.number().min(1).optional(), // Added page support
  sortBy: z.enum(['createdAt', 'filename', 'fileSizeBytes']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Schema for validating PDF ID in URL params
const pdfIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * @swagger
 * /api/v1/pdfs:
 *   post:
 *     tags:
 *       - PDFs
 *     summary: Upload a PDF file
 *     description: Upload a PDF document for processing. Max file size is 10MB.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file (max 10MB)
 *             required:
 *               - file
 *     responses:
 *       201:
 *         description: PDF uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   $ref: '#/components/schemas/Pdf'
 *       400:
 *         description: Invalid file or validation error
 *       401:
 *         description: Unauthorized
 *       413:
 *         description: File too large
 */
router.post(
  '/',
  pdfUpload.single('file'),
  validatePdfContent,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const file = req.file!;
    const userId = req.user!.sub;

    // Create PDF record
    const pdf = await pdfService.create({
      userId,
      filename: sanitizeFilename(file.originalname),
      filePath: file.path,
      fileSizeBytes: file.size,
    });

    // Add to processing queue
    await addPdfProcessingJob({
      pdfId: pdf.id,
      userId,
      filePath: file.path,
      filename: pdf.filename,
    });

    logger.info('PDF uploaded and queued', {
      pdfId: pdf.id,
      userId,
      filename: pdf.filename,
      size: file.size,
    });

    res.status(201).json({
      success: true,
      data: pdf,
      message: 'PDF uploaded and queued for processing',
    });
  })
);

/**
 * @swagger
 * /api/v1/pdfs:
 *   get:
 *     tags:
 *       - PDFs
 *     summary: List user's PDFs
 *     description: Get a paginated list of user's uploaded PDFs
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled]
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
 *           enum: [createdAt, filename, fileSizeBytes]
 *           default: createdAt
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: List of PDFs
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
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Pdf'
 *                     total: { type: integer }
 *                     limit: { type: integer }
 *                     offset: { type: integer }
 *                     hasMore: { type: boolean }
 */
router.get(
  '/',
  validate(listPdfsQuerySchema, 'query'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = req.user!.sub;
    const { status, limit, offset, page, sortBy, sortOrder } = req.query as z.infer<
      typeof listPdfsQuerySchema
    >;

    // Calculate offset from page if provided
    const calculatedOffset = page ? (page - 1) * limit : offset;

    const result = await pdfService.list({
      userId,
      status,
      limit,
      offset: calculatedOffset,
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
 * /api/v1/pdfs/{id}:
 *   get:
 *     tags:
 *       - PDFs
 *     summary: Get PDF details
 *     description: Get detailed information about a specific PDF
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
 *         description: PDF details
 *       403:
 *         description: Not owner of the PDF
 *       404:
 *         description: PDF not found
 */
router.get(
  '/:id',
  validate(pdfIdParamsSchema, 'params'),
  checkPdfOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const pdf = await pdfService.getByIdWithStats(id);
    if (!pdf) {
      throw new NotFoundError('PDF not found');
    }

    // Get processing status if pending or processing
    let processingStatus = null;
    if (pdf.status === 'pending' || pdf.status === 'processing') {
      processingStatus = await getJobStatus(id);
    }

    // Get question counts by difficulty if completed
    let questionCounts = null;
    if (pdf.status === 'completed') {
      questionCounts = await questionsService.getCountsByDifficulty(id);
    }

    res.json({
      success: true,
      data: {
        ...pdf,
        processingStatus,
        questionCounts,
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/pdfs/{id}/status:
 *   get:
 *     tags:
 *       - PDFs
 *     summary: Get PDF processing status
 *     description: Get real-time processing status for a PDF
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
 *         description: Processing status
 */
router.get(
  '/:id/status',
  validate(pdfIdParamsSchema, 'params'),
  checkPdfOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const pdf = await pdfService.getById(id);
    if (!pdf) {
      throw new NotFoundError('PDF not found');
    }

    const jobStatus = await getJobStatus(id);

    res.json({
      success: true,
      data: {
        pdfId: id,
        status: pdf.status,
        jobStatus,
        processingStartedAt: pdf.processingStartedAt,
        processingCompletedAt: pdf.processingCompletedAt,
        errorMessage: pdf.errorMessage,
      },
    });
  })
);

/**
 * @swagger
 * /api/v1/pdfs/{id}/download:
 *   get:
 *     tags:
 *       - PDFs
 *     summary: Download PDF file
 *     description: Download the original PDF file
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
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: PDF not found
 */
router.get(
  '/:id/download',
  validate(pdfIdParamsSchema, 'params'),
  checkPdfOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    const pdf = await pdfService.getById(id);
    if (!pdf) {
      throw new NotFoundError('PDF not found');
    }

    // Check if file exists
    if (!fs.existsSync(pdf.filePath)) {
      throw new NotFoundError('PDF file not found on server');
    }

    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(pdf.filePath);
    fileStream.pipe(res);
  })
);

/**
 * @swagger
 * /api/v1/pdfs/{id}/cancel:
 *   post:
 *     tags:
 *       - PDFs
 *     summary: Cancel PDF processing
 *     description: Cancel processing for a pending or processing PDF
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
 *         description: Processing cancelled
 *       400:
 *         description: Cannot cancel - already completed or failed
 */
router.post(
  '/:id/cancel',
  validate(pdfIdParamsSchema, 'params'),
  checkPdfOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Try to cancel the job in queue
    const cancelled = await cancelJob(id);

    // Update PDF status
    const pdf = await pdfService.cancelProcessing(id);

    logger.info('PDF processing cancelled', { pdfId: id, queueCancelled: cancelled });

    res.json({
      success: true,
      data: pdf,
      message: 'Processing cancelled',
    });
  })
);

/**
 * @swagger
 * /api/v1/pdfs/{id}:
 *   delete:
 *     tags:
 *       - PDFs
 *     summary: Delete a PDF
 *     description: Soft delete a PDF and its associated data
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
 *         description: PDF deleted
 *       403:
 *         description: Not owner of the PDF
 *       404:
 *         description: PDF not found
 */
router.delete(
  '/:id',
  validate(pdfIdParamsSchema, 'params'),
  checkPdfOwnership,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    // Try to cancel any pending job
    await cancelJob(id);

    // Soft delete the PDF
    await pdfService.softDelete(id);

    logger.info('PDF deleted', { pdfId: id, userId: req.user!.sub });

    res.json({
      success: true,
      message: 'PDF deleted successfully',
    });
  })
);

export { router as pdfRoutes };
