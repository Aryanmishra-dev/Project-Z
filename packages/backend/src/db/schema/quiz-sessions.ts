/**
 * Quiz Sessions table schema
 * Tracks user quiz attempts and progress
 */
import { pgTable, uuid, integer, timestamp, pgEnum, decimal, index } from 'drizzle-orm/pg-core';

import { pdfs } from './pdfs';
import { difficultyEnum } from './questions';
import { users } from './users';

/**
 * Quiz session status
 */
export const quizStatusEnum = pgEnum('quiz_status', [
  'in_progress', // User is actively taking the quiz
  'completed', // Quiz finished normally
  'abandoned', // User left without finishing
  'timed_out', // Session expired
]);

/**
 * Quiz Sessions table definition
 * Records each quiz attempt by a user
 */
export const quizSessions = pgTable(
  'quiz_sessions',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Reference to user taking the quiz */
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    /** Reference to source PDF */
    pdfId: uuid('pdf_id')
      .references(() => pdfs.id, { onDelete: 'cascade' })
      .notNull(),

    /** Optional difficulty filter applied */
    difficultyFilter: difficultyEnum('difficulty_filter'),

    /** Total number of questions in the session */
    totalQuestions: integer('total_questions').notNull(),

    /** Number of correct answers */
    correctAnswers: integer('correct_answers').default(0).notNull(),

    /** Current session status */
    status: quizStatusEnum('status').default('in_progress').notNull(),

    /** Calculated score percentage (0.00 - 100.00) */
    scorePercentage: decimal('score_percentage', { precision: 5, scale: 2 }),

    /** Session start timestamp */
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),

    /** Session completion timestamp */
    completedAt: timestamp('completed_at', { withTimezone: true }),

    /** Record creation timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Record last update timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    /** Index for user's quiz sessions */
    userIdIdx: index('idx_quiz_sessions_user_id').on(table.userId),

    /** Index for PDF's quiz sessions */
    pdfIdIdx: index('idx_quiz_sessions_pdf_id').on(table.pdfId),

    /** Index for session status */
    statusIdx: index('idx_quiz_sessions_status').on(table.status),

    /** Composite index for user's sessions by PDF */
    userPdfIdx: index('idx_quiz_sessions_user_pdf').on(table.userId, table.pdfId),

    /** Index for ordering by start time */
    startedAtIdx: index('idx_quiz_sessions_started_at').on(table.startedAt),
  })
);

/**
 * Type inference for quiz session records
 */
export type QuizSession = typeof quizSessions.$inferSelect;
export type NewQuizSession = typeof quizSessions.$inferInsert;
