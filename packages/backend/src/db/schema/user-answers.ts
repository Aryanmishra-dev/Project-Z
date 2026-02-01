/**
 * User Answers table schema
 * Records individual question responses within quiz sessions
 */
import { pgTable, uuid, text, boolean, integer, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';
import { quizSessions } from './quiz-sessions';
import { questions } from './questions';

/**
 * User confidence level for an answer
 */
export const confidenceLevelEnum = pgEnum('confidence_level', [
  'very_low',   // Just guessing
  'low',        // Unsure
  'medium',     // Somewhat confident
  'high',       // Pretty sure
  'very_high'   // Absolutely certain
]);

/**
 * User Answers table definition
 * Tracks each answer given during a quiz session
 */
export const userAnswers = pgTable('user_answers', {
  /** Unique identifier (UUID v4) */
  id: uuid('id').primaryKey().defaultRandom(),
  
  /** Reference to parent quiz session */
  quizSessionId: uuid('quiz_session_id').references(() => quizSessions.id, { onDelete: 'cascade' }).notNull(),
  
  /** Reference to the question being answered */
  questionId: uuid('question_id').references(() => questions.id, { onDelete: 'cascade' }).notNull(),
  
  /** User's selected option (A, B, C, or D) */
  selectedOption: text('selected_option').notNull(),
  
  /** Whether the answer was correct */
  isCorrect: boolean('is_correct').notNull(),
  
  /** Time spent on this question in seconds */
  timeSpentSeconds: integer('time_spent_seconds'),
  
  /** User's self-reported confidence level */
  confidenceLevel: confidenceLevelEnum('confidence_level'),
  
  /** When the answer was submitted */
  answeredAt: timestamp('answered_at', { withTimezone: true }).defaultNow().notNull(),
  
  /** Record creation timestamp */
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  /** Index for session's answers lookup */
  quizSessionIdIdx: index('idx_user_answers_session_id').on(table.quizSessionId),
  
  /** Index for question's answers (for analytics) */
  questionIdIdx: index('idx_user_answers_question_id').on(table.questionId),
  
  /** Index for correctness filtering */
  isCorrectIdx: index('idx_user_answers_is_correct').on(table.isCorrect),
  
  /** Composite unique constraint: one answer per question per session */
  sessionQuestionIdx: index('idx_user_answers_session_question').on(table.quizSessionId, table.questionId),
}));

/**
 * Type inference for user answer records
 */
export type UserAnswer = typeof userAnswers.$inferSelect;
export type NewUserAnswer = typeof userAnswers.$inferInsert;
