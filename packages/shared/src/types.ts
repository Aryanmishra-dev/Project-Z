import { z } from 'zod';

/**
 * Quiz difficulty levels
 */
export enum DifficultyLevel {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

/**
 * Question types
 */
export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  SHORT_ANSWER = 'short_answer',
}

/**
 * Validation schemas
 */
export const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  quizId: z.string().uuid(),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(DifficultyLevel),
  questionText: z.string().min(10).max(500),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  qualityScore: z.number().min(0).max(1),
  createdAt: z.date().optional(),
});

export const QuizSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  title: z.string().min(1).max(200),
  pdfFileName: z.string(),
  pdfFilePath: z.string(),
  totalQuestions: z.number().int().min(1),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const UserSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email(),
  passwordHash: z.string().optional(),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const UploadPdfSchema = z.object({
  file: z.any(),
  title: z.string().min(1).max(200).optional(),
  difficulty: z.nativeEnum(DifficultyLevel).optional(),
  questionCount: z.number().int().min(5).max(50).default(10),
});

export const CreateQuestionSchema = z.object({
  quizId: z.string().uuid(),
  type: z.nativeEnum(QuestionType),
  difficulty: z.nativeEnum(DifficultyLevel),
  questionText: z.string().min(10).max(500),
  options: z.array(z.string()).optional(),
  correctAnswer: z.string().min(1),
  explanation: z.string().optional(),
  qualityScore: z.number().min(0).max(1),
});

/**
 * Type exports
 */
export type Question = z.infer<typeof QuestionSchema>;
export type Quiz = z.infer<typeof QuizSchema>;
export type User = z.infer<typeof UserSchema>;
export type CreateQuestion = z.infer<typeof CreateQuestionSchema>;
export type UploadPdf = z.infer<typeof UploadPdfSchema>;

/**
 * API Response types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * NLP Service types
 */
export interface GenerateQuestionsRequest {
  text: string;
  count: number;
  difficulty?: DifficultyLevel;
}

export interface GenerateQuestionsResponse {
  questions: CreateQuestion[];
  processingTime: number;
}
