/**
 * Questions table schema
 * Stores AI-generated quiz questions from PDFs
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  pgEnum,
  jsonb,
  decimal,
  index,
} from 'drizzle-orm/pg-core';

import { pdfs } from './pdfs';

/**
 * Question difficulty levels
 */
export const difficultyEnum = pgEnum('difficulty_level', ['easy', 'medium', 'hard']);

/**
 * Question validation status
 */
export const validationStatusEnum = pgEnum('validation_status', [
  'pending', // Not yet validated
  'valid', // Passed validation
  'invalid', // Failed validation
  'needs_review', // Requires manual review
]);

/**
 * Question options structure (for multiple choice)
 */
export interface QuestionOptions {
  A: string;
  B: string;
  C: string;
  D: string;
}

/**
 * Validation errors structure
 */
export interface ValidationErrors {
  errors: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  validatedAt: string;
}

/**
 * Questions table definition
 * Stores generated quiz questions with quality metrics
 */
export const questions = pgTable(
  'questions',
  {
    /** Unique identifier (UUID v4) */
    id: uuid('id').primaryKey().defaultRandom(),

    /** Reference to source PDF */
    pdfId: uuid('pdf_id')
      .references(() => pdfs.id, { onDelete: 'cascade' })
      .notNull(),

    /** The question text */
    questionText: text('question_text').notNull(),

    /** Answer options (JSONB with A, B, C, D keys) */
    options: jsonb('options').$type<QuestionOptions>().notNull(),

    /** Correct answer option (A, B, C, or D) */
    correctOption: text('correct_option').notNull(),

    /** Explanation of the correct answer */
    explanation: text('explanation'),

    /** Question difficulty level */
    difficulty: difficultyEnum('difficulty').default('medium').notNull(),

    /** Reference to page number in source PDF */
    pageReference: integer('page_reference'),

    /** AI-generated quality score (0.00 - 1.00) */
    qualityScore: decimal('quality_score', { precision: 3, scale: 2 }).notNull(),

    /** Validation status */
    validationStatus: validationStatusEnum('validation_status').default('pending').notNull(),

    /** Validation errors if any (JSONB) */
    validationErrors: jsonb('validation_errors').$type<ValidationErrors>(),

    /** Record creation timestamp */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    /** Record last update timestamp */
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    /** Index for PDF's questions lookup */
    pdfIdIdx: index('idx_questions_pdf_id').on(table.pdfId),

    /** Index for difficulty filtering */
    difficultyIdx: index('idx_questions_difficulty').on(table.difficulty),

    /** Index for quality score filtering */
    qualityIdx: index('idx_questions_quality').on(table.qualityScore),

    /** Index for validation status filtering */
    validationIdx: index('idx_questions_validation').on(table.validationStatus),

    /** Composite index for PDF questions by difficulty */
    pdfDifficultyIdx: index('idx_questions_pdf_difficulty').on(table.pdfId, table.difficulty),

    /** Composite index for valid questions above quality threshold */
    validQualityIdx: index('idx_questions_valid_quality').on(
      table.validationStatus,
      table.qualityScore
    ),
  })
);

/**
 * Type inference for question records
 */
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
