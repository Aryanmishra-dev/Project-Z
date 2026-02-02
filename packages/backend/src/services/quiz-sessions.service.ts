/**
 * Quiz Sessions Service
 * Business logic for quiz session management
 */
import { eq, and, desc, count, sql } from 'drizzle-orm';

import { db } from '../db';
import { questionsService } from './questions.service';
import { pdfs } from '../db/schema/pdfs';
import { questions, type Question } from '../db/schema/questions';
import { quizSessions, type QuizSession, type NewQuizSession } from '../db/schema/quiz-sessions';
import { userAnswers, type UserAnswer, type NewUserAnswer } from '../db/schema/user-answers';
import { NotFoundError, AppError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Session creation options
 */
export interface CreateSessionOptions {
  userId: string;
  pdfId: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
}

/**
 * Session with answers and questions
 */
export interface SessionWithDetails extends QuizSession {
  answers: (UserAnswer & { question: Question })[];
  pdf?: {
    id: string;
    filename: string;
  };
}

/**
 * Answer submission data
 */
export interface AnswerSubmission {
  questionId: string;
  selectedOption: string;
  timeSpentSeconds?: number;
  confidenceLevel?: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
}

/**
 * Session list options
 */
export interface ListSessionsOptions {
  userId: string;
  pdfId?: string;
  status?: 'in_progress' | 'completed' | 'abandoned' | 'timed_out';
  limit?: number;
  offset?: number;
}

/**
 * Session list result
 */
export interface ListSessionsResult {
  sessions: SessionWithDetails[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

class QuizSessionsService {
  /**
   * Create a new quiz session
   */
  async create(options: CreateSessionOptions): Promise<{
    session: QuizSession;
    questions: Question[];
  }> {
    const { userId, pdfId, questionCount = 10, difficulty } = options;

    logger.debug('Creating quiz session', { userId, pdfId, questionCount, difficulty });

    // Verify PDF exists and is completed
    const [pdf] = await db
      .select()
      .from(pdfs)
      .where(and(eq(pdfs.id, pdfId), eq(pdfs.userId, userId)));

    if (!pdf) {
      throw new NotFoundError('PDF not found');
    }

    if (pdf.status !== 'completed') {
      throw new ValidationError('PDF processing not complete', {
        pdfId: ['PDF must be processed before starting a quiz'],
      });
    }

    // Get random questions
    const quizQuestions = await questionsService.getRandomQuestions({
      pdfId,
      count: questionCount,
      difficulty,
      minQualityScore: 0.5,
    });

    if (quizQuestions.length === 0) {
      throw new ValidationError('No questions available', {
        pdfId: ['No valid questions found for this PDF'],
      });
    }

    // Create session
    const [session] = await db
      .insert(quizSessions)
      .values({
        userId,
        pdfId,
        difficultyFilter: difficulty,
        totalQuestions: quizQuestions.length,
        correctAnswers: 0,
        status: 'in_progress',
      })
      .returning();

    logger.info('Quiz session created', {
      sessionId: session.id,
      userId,
      pdfId,
      questionCount: quizQuestions.length,
    });

    // Return session with questions (without correct answers for client)
    const questionsForClient = quizQuestions.map((q) => ({
      ...q,
      correctOption: undefined as unknown as typeof q.correctOption, // Hide correct answer
      explanation: undefined as unknown as typeof q.explanation,
    }));

    return {
      session: session!,
      questions: questionsForClient as unknown as Question[],
    };
  }

  /**
   * Get a session by ID
   */
  async getById(id: string): Promise<QuizSession | null> {
    const [session] = await db.select().from(quizSessions).where(eq(quizSessions.id, id));

    return session || null;
  }

  /**
   * Get a session by ID, throw if not found
   */
  async getByIdOrThrow(id: string): Promise<QuizSession> {
    const session = await this.getById(id);
    if (!session) {
      throw new NotFoundError('Quiz session not found');
    }
    return session;
  }

  /**
   * Get session with all details (answers and questions)
   */
  async getWithDetails(id: string): Promise<SessionWithDetails | null> {
    const session = await this.getById(id);
    if (!session) return null;

    // Get answers with questions
    const answersWithQuestions = await db
      .select({
        answer: userAnswers,
        question: questions,
      })
      .from(userAnswers)
      .innerJoin(questions, eq(userAnswers.questionId, questions.id))
      .where(eq(userAnswers.quizSessionId, id))
      .orderBy(userAnswers.answeredAt);

    // Get PDF info
    const [pdf] = await db
      .select({ id: pdfs.id, filename: pdfs.filename })
      .from(pdfs)
      .where(eq(pdfs.id, session.pdfId));

    return {
      ...session,
      answers: answersWithQuestions.map((row) => ({
        ...row.answer,
        question: row.question,
      })),
      pdf: pdf || undefined,
    };
  }

  /**
   * Submit an answer to a question
   */
  async submitAnswer(
    sessionId: string,
    submission: AnswerSubmission
  ): Promise<{
    isCorrect: boolean;
    correctOption: string;
    explanation: string | null;
  }> {
    const session = await this.getByIdOrThrow(sessionId);

    if (session.status !== 'in_progress') {
      throw new ValidationError('Session not in progress', {
        sessionId: ['Cannot submit answers to a completed session'],
      });
    }

    // Get the question
    const question = await questionsService.getByIdOrThrow(submission.questionId);

    // Check if already answered
    const [existing] = await db
      .select()
      .from(userAnswers)
      .where(
        and(
          eq(userAnswers.quizSessionId, sessionId),
          eq(userAnswers.questionId, submission.questionId)
        )
      );

    if (existing) {
      throw new ValidationError('Question already answered', {
        questionId: ['This question has already been answered'],
      });
    }

    // Validate selected option
    if (!['A', 'B', 'C', 'D'].includes(submission.selectedOption)) {
      throw new ValidationError('Invalid option', {
        selectedOption: ['Must be A, B, C, or D'],
      });
    }

    // Check if correct
    const isCorrect = submission.selectedOption === question.correctOption;

    // Save answer
    await db.insert(userAnswers).values({
      quizSessionId: sessionId,
      questionId: submission.questionId,
      selectedOption: submission.selectedOption,
      isCorrect,
      timeSpentSeconds: submission.timeSpentSeconds,
      confidenceLevel: submission.confidenceLevel,
    });

    // Update correct answers count if correct
    if (isCorrect) {
      await db
        .update(quizSessions)
        .set({
          correctAnswers: sql`${quizSessions.correctAnswers} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(quizSessions.id, sessionId));
    }

    logger.debug('Answer submitted', {
      sessionId,
      questionId: submission.questionId,
      isCorrect,
    });

    return {
      isCorrect,
      correctOption: question.correctOption,
      explanation: question.explanation,
    };
  }

  /**
   * Complete a quiz session
   */
  async complete(sessionId: string): Promise<SessionWithDetails> {
    const session = await this.getByIdOrThrow(sessionId);

    if (session.status !== 'in_progress') {
      throw new ValidationError('Session already completed', {
        sessionId: ['Session is not in progress'],
      });
    }

    // Count answered questions
    const [{ answered }] = await db
      .select({ answered: count() })
      .from(userAnswers)
      .where(eq(userAnswers.quizSessionId, sessionId));

    // Calculate score
    const scorePercentage =
      session.totalQuestions > 0
        ? ((session.correctAnswers / session.totalQuestions) * 100).toFixed(2)
        : '0.00';

    // Update session
    await db
      .update(quizSessions)
      .set({
        status: 'completed',
        scorePercentage,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quizSessions.id, sessionId));

    logger.info('Quiz session completed', {
      sessionId,
      answered: Number(answered),
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      scorePercentage,
    });

    // Return updated session with details
    return this.getWithDetails(sessionId) as Promise<SessionWithDetails>;
  }

  /**
   * Abandon a quiz session
   */
  async abandon(sessionId: string): Promise<QuizSession> {
    const session = await this.getByIdOrThrow(sessionId);

    if (session.status !== 'in_progress') {
      throw new ValidationError('Session not in progress', {
        sessionId: ['Can only abandon in-progress sessions'],
      });
    }

    const [updated] = await db
      .update(quizSessions)
      .set({
        status: 'abandoned',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quizSessions.id, sessionId))
      .returning();

    logger.info('Quiz session abandoned', { sessionId });
    return updated;
  }

  /**
   * List sessions for a user
   */
  async list(options: ListSessionsOptions): Promise<ListSessionsResult> {
    const { userId, pdfId, status, limit = 20, offset = 0 } = options;

    // Build conditions
    const conditions = [eq(quizSessions.userId, userId)];
    if (pdfId) {
      conditions.push(eq(quizSessions.pdfId, pdfId));
    }
    if (status) {
      conditions.push(eq(quizSessions.status, status));
    }

    // Get total count
    const [{ total }] = await db
      .select({ total: count() })
      .from(quizSessions)
      .where(and(...conditions));

    // Get sessions with PDF info
    const results = await db
      .select({
        session: quizSessions,
        pdf: {
          id: pdfs.id,
          filename: pdfs.filename,
        },
      })
      .from(quizSessions)
      .innerJoin(pdfs, eq(quizSessions.pdfId, pdfs.id))
      .where(and(...conditions))
      .orderBy(desc(quizSessions.createdAt))
      .limit(limit)
      .offset(offset);

    const sessions: SessionWithDetails[] = results.map((r) => ({
      ...r.session,
      answers: [] as any[],
      pdf: r.pdf,
    }));

    return {
      sessions,
      total: Number(total),
      limit,
      offset,
      hasMore: offset + sessions.length < Number(total),
    };
  }

  /**
   * Get user's quiz statistics
   */
  async getUserStats(userId: string): Promise<{
    totalQuizzes: number;
    completedQuizzes: number;
    averageScore: number;
    totalQuestionsAnswered: number;
    correctAnswers: number;
  }> {
    const [stats] = await db
      .select({
        totalQuizzes: count(),
        completedQuizzes: sql<number>`count(*) filter (where ${quizSessions.status} = 'completed')`,
        totalQuestionsAnswered: sql<number>`sum(${quizSessions.totalQuestions})`,
        totalCorrect: sql<number>`sum(${quizSessions.correctAnswers})`,
      })
      .from(quizSessions)
      .where(eq(quizSessions.userId, userId));

    // Calculate average score from completed quizzes
    const [avgResult] = await db
      .select({
        avgScore: sql<number>`avg(${quizSessions.scorePercentage}::numeric)`,
      })
      .from(quizSessions)
      .where(and(eq(quizSessions.userId, userId), eq(quizSessions.status, 'completed')));

    return {
      totalQuizzes: Number(stats?.totalQuizzes || 0),
      completedQuizzes: Number(stats?.completedQuizzes || 0),
      averageScore: Number(avgResult?.avgScore || 0),
      totalQuestionsAnswered: Number(stats?.totalQuestionsAnswered || 0),
      correctAnswers: Number(stats?.totalCorrect || 0),
    };
  }

  /**
   * Check session ownership
   */
  async checkOwnership(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getById(sessionId);
    return session?.userId === userId;
  }
}

export const quizSessionsService = new QuizSessionsService();
