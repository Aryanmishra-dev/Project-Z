import { pgTable, uuid, varchar, text, timestamp, integer, decimal, pgEnum, boolean } from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard']);
export const questionTypeEnum = pgEnum('question_type', ['multiple_choice', 'true_false', 'short_answer']);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 100 }).notNull(),
  role: userRoleEnum('role').default('user').notNull(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

// Type exports
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export const quizzes = pgTable('quizzes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  pdfFileName: varchar('pdf_file_name', { length: 255 }).notNull(),
  pdfFilePath: text('pdf_file_path').notNull(),
  totalQuestions: integer('total_questions').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  quizId: uuid('quiz_id').references(() => quizzes.id, { onDelete: 'cascade' }).notNull(),
  type: questionTypeEnum('type').notNull(),
  difficulty: difficultyEnum('difficulty').notNull(),
  questionText: text('question_text').notNull(),
  options: text('options').array(),
  correctAnswer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  qualityScore: decimal('quality_score', { precision: 3, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
