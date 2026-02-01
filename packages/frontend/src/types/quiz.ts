export type QuizSessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  pdfId: string;
  questionText: string;
  options: QuestionOption[];
  correctOptionIndex: number;
  difficulty: Difficulty;
  explanation: string | null;
  qualityScore: number;
  validationStatus: string;
  createdAt: string;
}

export interface QuestionOption {
  index: number;
  text: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  pdfId: string;
  status: QuizSessionStatus;
  totalQuestions: number;
  correctAnswers: number;
  score: number | null;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number | null;
  createdAt: string;
}

export interface QuizSessionWithDetails extends QuizSession {
  pdf: {
    id: string;
    originalFilename: string;
  };
  questions: QuestionWithAnswer[];
}

export interface QuestionWithAnswer extends Question {
  userAnswer?: UserAnswer;
}

export interface UserAnswer {
  id: string;
  quizSessionId: string;
  questionId: string;
  selectedOptionIndex: number | null;
  isCorrect: boolean;
  answeredAt: string;
}

export interface QuizConfig {
  pdfId: string;
  questionCount: number;
  difficulty?: Difficulty | 'all';
}

export interface SubmitAnswerRequest {
  questionId: string;
  selectedOptionIndex: number;
}

export interface QuizResults {
  session: QuizSession;
  questions: QuestionWithAnswer[];
  breakdown: {
    easy: { correct: number; total: number };
    medium: { correct: number; total: number };
    hard: { correct: number; total: number };
  };
}
