/**
 * Questions Service
 * Business logic for quiz questions management
 */
import { eq, and, desc, asc, gte, sql, count, inArray } from 'drizzle-orm';
import { db } from '../db';
import { questions, type Question, type NewQuestion } from '../db/schema/questions';
import { pdfs } from '../db/schema/pdfs';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Question listing options
 */
export interface ListQuestionsOptions {
  pdfId: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  validationStatus?: 'pending' | 'valid' | 'invalid' | 'needs_review';
  minQualityScore?: number;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'difficulty' | 'qualityScore';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Question list result with pagination
 */
export interface ListQuestionsResult {
  questions: Question[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Random questions options
 */
export interface RandomQuestionsOptions {
  pdfId: string;
  count: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  excludeIds?: string[];
  minQualityScore?: number;
}

class QuestionsService {
  /**
   * Create a batch of questions
   */
  async createBatch(questionsData: NewQuestion[]): Promise<Question[]> {
    if (questionsData.length === 0) return [];

    logger.debug('Creating batch of questions', { count: questionsData.length });

    const created = await db.insert(questions).values(questionsData).returning();

    logger.info('Questions batch created', { count: created.length });
    return created;
  }

  /**
   * Get a question by ID
   */
  async getById(id: string): Promise<Question | null> {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, id));

    return question || null;
  }

  /**
   * Get a question by ID, throw if not found
   */
  async getByIdOrThrow(id: string): Promise<Question> {
    const question = await this.getById(id);
    if (!question) {
      throw new NotFoundError('Question not found');
    }
    return question;
  }

  /**
   * List questions for a PDF with filtering and pagination
   */
  async list(options: ListQuestionsOptions): Promise<ListQuestionsResult> {
    const {
      pdfId,
      difficulty,
      validationStatus,
      minQualityScore,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = options;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [eq(questions.pdfId, pdfId)];
    
    if (difficulty) {
      conditions.push(eq(questions.difficulty, difficulty));
    }
    
    if (validationStatus) {
      conditions.push(eq(questions.validationStatus, validationStatus));
    }
    
    if (minQualityScore !== undefined) {
      conditions.push(gte(questions.qualityScore, minQualityScore.toString()));
    }

    // Get total count
    const countResult = await db
      .select({ total: count() })
      .from(questions)
      .where(and(...conditions));
    const total = countResult[0]?.total ?? 0;

    // Get paginated results
    const sortColumn = questions[sortBy];
    const orderFn = sortOrder === 'desc' ? desc : asc;

    const results = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    return {
      questions: results,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + results.length < Number(total),
    };
  }

  /**
   * Get random questions for a quiz
   */
  async getRandomQuestions(options: RandomQuestionsOptions): Promise<Question[]> {
    const { pdfId, count: questionCount, difficulty, excludeIds = [], minQualityScore = 0.5 } = options;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(questions.pdfId, pdfId),
      eq(questions.validationStatus, 'valid'),
      gte(questions.qualityScore, minQualityScore.toString()),
    ];

    if (difficulty) {
      conditions.push(eq(questions.difficulty, difficulty));
    }

    // Exclude already used questions
    if (excludeIds && excludeIds.length > 0) {
      conditions.push(sql`${questions.id} NOT IN (${sql.join(excludeIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Get random questions using PostgreSQL RANDOM()
    const results = await db
      .select()
      .from(questions)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(questionCount);

    return results;
  }

  /**
   * Get questions by multiple IDs
   */
  async getByIds(ids: string[]): Promise<Question[]> {
    if (ids.length === 0) return [];

    return db
      .select()
      .from(questions)
      .where(inArray(questions.id, ids));
  }

  /**
   * Get question count for a PDF
   */
  async getCountByPdfId(pdfId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: count() })
      .from(questions)
      .where(eq(questions.pdfId, pdfId));

    return Number(total);
  }

  /**
   * Get question counts by difficulty for a PDF
   */
  async getCountsByDifficulty(pdfId: string): Promise<{
    easy: number;
    medium: number;
    hard: number;
  }> {
    const results = await db
      .select({
        difficulty: questions.difficulty,
        count: count(),
      })
      .from(questions)
      .where(and(
        eq(questions.pdfId, pdfId),
        eq(questions.validationStatus, 'valid')
      ))
      .groupBy(questions.difficulty);

    const counts = { easy: 0, medium: 0, hard: 0 };
    for (const row of results) {
      counts[row.difficulty] = Number(row.count);
    }

    return counts;
  }

  /**
   * Update question validation status
   */
  async updateValidationStatus(
    id: string,
    status: 'pending' | 'valid' | 'invalid' | 'needs_review',
    errors?: { code: string; message: string; field?: string }[]
  ): Promise<Question> {
    const updateData: Partial<NewQuestion> = {
      validationStatus: status,
      updatedAt: new Date(),
    };

    if (errors) {
      updateData.validationErrors = {
        errors,
        validatedAt: new Date().toISOString(),
      };
    }

    const [updated] = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundError('Question not found');
    }

    return updated;
  }

  /**
   * Batch validate questions (mark all as valid for a PDF)
   */
  async batchValidate(pdfId: string): Promise<number> {
    const result = await db
      .update(questions)
      .set({
        validationStatus: 'valid',
        updatedAt: new Date(),
      })
      .where(and(
        eq(questions.pdfId, pdfId),
        eq(questions.validationStatus, 'pending')
      ));

    return result.rowCount || 0;
  }

  /**
   * Delete questions for a PDF
   */
  async deleteByPdfId(pdfId: string): Promise<number> {
    const result = await db
      .delete(questions)
      .where(eq(questions.pdfId, pdfId));

    logger.info('Questions deleted for PDF', { pdfId, count: result.rowCount });
    return result.rowCount || 0;
  }

  /**
   * Get questions requiring owner verification
   */
  async verifyOwnership(questionId: string, userId: string): Promise<boolean> {
    const [result] = await db
      .select({ userId: pdfs.userId })
      .from(questions)
      .innerJoin(pdfs, eq(questions.pdfId, pdfs.id))
      .where(eq(questions.id, questionId));

    return result?.userId === userId;
  }
}

export const questionsService = new QuestionsService();
