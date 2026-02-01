/**
 * Database schema index
 * Exports all tables and types for use throughout the application
 */

// User management
export { users, userRoleEnum } from './users';
export type { User, NewUser } from './users';

// Refresh tokens
export { refreshTokens } from './refresh-tokens';
export type { RefreshToken, NewRefreshToken } from './refresh-tokens';

// PDF documents
export { pdfs, pdfStatusEnum } from './pdfs';
export type { Pdf, NewPdf, PdfMetadata } from './pdfs';

// Questions
export { questions, difficultyEnum, validationStatusEnum } from './questions';
export type { Question, NewQuestion, QuestionOptions, ValidationErrors } from './questions';

// Quiz sessions
export { quizSessions, quizStatusEnum } from './quiz-sessions';
export type { QuizSession, NewQuizSession } from './quiz-sessions';

// User answers
export { userAnswers, confidenceLevelEnum } from './user-answers';
export type { UserAnswer, NewUserAnswer } from './user-answers';
