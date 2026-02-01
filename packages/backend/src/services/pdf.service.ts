/**
 * PDF Service
 * Business logic for PDF document management
 */
import { eq, and, desc, isNull, sql, count } from 'drizzle-orm';
import { db } from '../db';
import { pdfs, type Pdf, type NewPdf, type PdfMetadata } from '../db/schema/pdfs';
import { questions } from '../db/schema/questions';
import { NotFoundError, AppError } from '../utils/errors';
import { logger } from '../utils/logger';
import fs from 'fs/promises';

/**
 * PDF listing options
 */
export interface ListPdfsOptions {
  userId: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'filename' | 'fileSizeBytes';
  sortOrder?: 'asc' | 'desc';
}

/**
 * PDF list result with pagination
 */
export interface ListPdfsResult {
  pdfs: Pdf[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * PDF with question count
 */
export interface PdfWithStats extends Pdf {
  questionCount: number;
}

class PdfService {
  /**
   * Create a new PDF record
   */
  async create(data: {
    userId: string;
    filename: string;
    filePath: string;
    fileSizeBytes: number;
  }): Promise<Pdf> {
    logger.debug('Creating PDF record', { filename: data.filename, userId: data.userId });

    const [pdf] = await db
      .insert(pdfs)
      .values({
        userId: data.userId,
        filename: data.filename,
        filePath: data.filePath,
        fileSizeBytes: data.fileSizeBytes,
        status: 'pending',
      })
      .returning();

    if (!pdf) {
      throw new AppError('Failed to create PDF record', 500, 'INTERNAL_ERROR');
    }

    logger.info('PDF record created', { pdfId: pdf.id, filename: pdf.filename });
    return pdf;
  }

  /**
   * Get a PDF by ID
   */
  async getById(id: string): Promise<Pdf | null> {
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, id), isNull(pdfs.deletedAt)));

    return pdf || null;
  }

  /**
   * Get a PDF by ID with question count
   */
  async getByIdWithStats(id: string): Promise<PdfWithStats | null> {
    const [result] = await db
      .select({
        pdf: pdfs,
        questionCount: count(questions.id),
      })
      .from(pdfs)
      .leftJoin(questions, eq(pdfs.id, questions.pdfId))
      .where(and(eq(pdfs.id, id), isNull(pdfs.deletedAt)))
      .groupBy(pdfs.id);

    if (!result) return null;

    return {
      ...result.pdf,
      questionCount: Number(result.questionCount),
    };
  }

  /**
   * Get a PDF by ID, throw if not found
   */
  async getByIdOrThrow(id: string): Promise<Pdf> {
    const pdf = await this.getById(id);
    if (!pdf) {
      throw new NotFoundError('PDF not found');
    }
    return pdf;
  }

  /**
   * List PDFs for a user with pagination
   */
  async list(options: ListPdfsOptions): Promise<ListPdfsResult> {
    const {
      userId,
      status,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where conditions
    const conditions = [eq(pdfs.userId, userId), isNull(pdfs.deletedAt)];
    if (status) {
      conditions.push(eq(pdfs.status, status));
    }

    // Get total count
    const countResult = await db
      .select({ total: count() })
      .from(pdfs)
      .where(and(...conditions));
    const total = countResult[0]?.total ?? 0;

    // Get paginated results with question counts
    const results = await db
      .select({
        pdf: pdfs,
        questionCount: count(questions.id),
      })
      .from(pdfs)
      .leftJoin(questions, eq(pdfs.id, questions.pdfId))
      .where(and(...conditions))
      .groupBy(pdfs.id)
      .orderBy(sortOrder === 'desc' ? desc(pdfs[sortBy]) : pdfs[sortBy])
      .limit(limit)
      .offset(offset);

    const pdfList = results.map((r) => ({
      ...r.pdf,
      questionCount: Number(r.questionCount),
    }));

    return {
      pdfs: pdfList,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + pdfList.length < Number(total),
    };
  }

  /**
   * Update PDF status
   */
  async updateStatus(
    id: string,
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled',
    extras?: {
      pageCount?: number;
      metadata?: PdfMetadata;
      errorMessage?: string;
    }
  ): Promise<Pdf> {
    const updateData: Partial<NewPdf> & { processingStartedAt?: Date; processingCompletedAt?: Date } = {
      status,
      updatedAt: new Date(),
    };

    if (status === 'processing') {
      updateData.processingStartedAt = new Date();
    }

    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      updateData.processingCompletedAt = new Date();
    }

    if (extras?.pageCount !== undefined) {
      updateData.pageCount = extras.pageCount;
    }

    if (extras?.metadata) {
      updateData.metadata = extras.metadata;
    }

    if (extras?.errorMessage) {
      updateData.errorMessage = extras.errorMessage;
    }

    const [updated] = await db
      .update(pdfs)
      .set(updateData)
      .where(eq(pdfs.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError('PDF not found');
    }

    logger.info('PDF status updated', { pdfId: id, status, ...extras });
    return updated;
  }

  /**
   * Soft delete a PDF
   */
  async softDelete(id: string): Promise<void> {
    const pdf = await this.getByIdOrThrow(id);

    // Mark as deleted in database
    await db
      .update(pdfs)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pdfs.id, id));

    // Delete file from disk (async, don't wait)
    this.deleteFile(pdf.filePath).catch((error) => {
      logger.error('Failed to delete PDF file', { pdfId: id, filePath: pdf.filePath, error });
    });

    logger.info('PDF soft deleted', { pdfId: id });
  }

  /**
   * Hard delete a PDF (for cleanup)
   */
  async hardDelete(id: string): Promise<void> {
    const pdf = await this.getById(id);
    if (!pdf) return;

    // Delete questions first (cascade should handle, but be explicit)
    await db.delete(questions).where(eq(questions.pdfId, id));

    // Delete PDF record
    await db.delete(pdfs).where(eq(pdfs.id, id));

    // Delete file
    await this.deleteFile(pdf.filePath);

    logger.info('PDF hard deleted', { pdfId: id });
  }

  /**
   * Delete PDF file from disk
   */
  private async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      logger.debug('PDF file deleted', { filePath });
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      // File already doesn't exist, that's fine
    }
  }

  /**
   * Get file path for a PDF
   */
  async getFilePath(id: string): Promise<string> {
    const pdf = await this.getByIdOrThrow(id);
    return pdf.filePath;
  }

  /**
   * Check if file exists on disk
   */
  async fileExists(id: string): Promise<boolean> {
    const pdf = await this.getByIdOrThrow(id);
    try {
      await fs.access(pdf.filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get PDFs pending processing
   */
  async getPendingPdfs(limit = 10): Promise<Pdf[]> {
    return db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.status, 'pending'), isNull(pdfs.deletedAt)))
      .orderBy(pdfs.createdAt)
      .limit(limit);
  }

  /**
   * Get stale processing PDFs (stuck for more than 30 minutes)
   */
  async getStaleProcessingPdfs(): Promise<Pdf[]> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    return db
      .select()
      .from(pdfs)
      .where(
        and(
          eq(pdfs.status, 'processing'),
          sql`${pdfs.processingStartedAt} < ${thirtyMinutesAgo}`,
          isNull(pdfs.deletedAt)
        )
      );
  }

  /**
   * Cancel processing for a PDF
   */
  async cancelProcessing(id: string): Promise<Pdf> {
    const pdf = await this.getByIdOrThrow(id);

    if (pdf.status !== 'pending' && pdf.status !== 'processing') {
      throw new AppError('Can only cancel pending or processing PDFs', 400, 'INVALID_STATE');
    }

    return this.updateStatus(id, 'cancelled');
  }

  /**
   * Get user's PDF statistics
   */
  async getUserStats(userId: string): Promise<{
    totalPdfs: number;
    completedPdfs: number;
    pendingPdfs: number;
    failedPdfs: number;
    totalQuestions: number;
  }> {
    const [stats] = await db
      .select({
        totalPdfs: count(),
        completedPdfs: sql<number>`count(*) filter (where ${pdfs.status} = 'completed')`,
        pendingPdfs: sql<number>`count(*) filter (where ${pdfs.status} = 'pending')`,
        failedPdfs: sql<number>`count(*) filter (where ${pdfs.status} = 'failed')`,
      })
      .from(pdfs)
      .where(and(eq(pdfs.userId, userId), isNull(pdfs.deletedAt)));

    const [questionStats] = await db
      .select({
        totalQuestions: count(),
      })
      .from(questions)
      .innerJoin(pdfs, eq(questions.pdfId, pdfs.id))
      .where(and(eq(pdfs.userId, userId), isNull(pdfs.deletedAt)));

    return {
      totalPdfs: Number(stats?.totalPdfs || 0),
      completedPdfs: Number(stats?.completedPdfs || 0),
      pendingPdfs: Number(stats?.pendingPdfs || 0),
      failedPdfs: Number(stats?.failedPdfs || 0),
      totalQuestions: Number(questionStats?.totalQuestions || 0),
    };
  }
}

export const pdfService = new PdfService();
