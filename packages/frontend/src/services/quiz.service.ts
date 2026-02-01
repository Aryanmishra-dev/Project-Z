import { api } from '@/lib/api';
import type {
  Question,
  QuizSession,
  QuizSessionWithDetails,
  QuizConfig,
  SubmitAnswerRequest,
  QuizResults,
  Difficulty,
} from '@/types';

export interface QuestionListParams {
  pdfId?: string;
  difficulty?: Difficulty;
  page?: number;
  limit?: number;
}

export const quizService = {
  /**
   * Get questions with optional filters
   */
  async getQuestions(params: QuestionListParams = {}): Promise<{
    questions: Question[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        questions: Question[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/api/v1/questions', { params });
    return response.data.data;
  },

  /**
   * Get random questions for a quiz
   */
  async getRandomQuestions(params: {
    pdfId: string;
    count: number;
    difficulty?: Difficulty;
  }): Promise<Question[]> {
    const response = await api.get<{
      success: boolean;
      data: { questions: Question[] };
    }>('/api/v1/questions/random', { params });
    return response.data.data.questions;
  },

  /**
   * Get question counts for a PDF
   */
  async getQuestionCounts(pdfId: string): Promise<{
    total: number;
    byDifficulty: Record<Difficulty, number>;
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        total: number;
        byDifficulty: Record<Difficulty, number>;
      };
    }>('/api/v1/questions/counts', { params: { pdfId } });
    return response.data.data;
  },

  /**
   * Create a new quiz session
   */
  async createSession(config: QuizConfig): Promise<QuizSessionWithDetails> {
    const response = await api.post<{
      success: boolean;
      data: { session: QuizSessionWithDetails };
    }>('/api/v1/quiz-sessions', config);
    return response.data.data.session;
  },

  /**
   * Get a quiz session by ID
   */
  async getSession(sessionId: string): Promise<QuizSessionWithDetails> {
    const response = await api.get<{
      success: boolean;
      data: { session: QuizSessionWithDetails };
    }>(`/api/v1/quiz-sessions/${sessionId}`);
    return response.data.data.session;
  },

  /**
   * Get list of user's quiz sessions
   */
  async listSessions(params: {
    page?: number;
    limit?: number;
    status?: string;
    pdfId?: string;
  } = {}): Promise<{
    sessions: QuizSession[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const response = await api.get<{
      success: boolean;
      data: {
        sessions: QuizSession[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
    }>('/api/v1/quiz-sessions', { params });
    return response.data.data;
  },

  /**
   * Submit an answer for a question
   */
  async submitAnswer(
    sessionId: string,
    answer: SubmitAnswerRequest
  ): Promise<{
    correct: boolean;
    correctOptionIndex: number;
  }> {
    const response = await api.post<{
      success: boolean;
      data: {
        correct: boolean;
        correctOptionIndex: number;
      };
    }>(`/api/v1/quiz-sessions/${sessionId}/answers`, answer);
    return response.data.data;
  },

  /**
   * Complete a quiz session
   */
  async completeSession(sessionId: string): Promise<QuizResults> {
    const response = await api.post<{
      success: boolean;
      data: QuizResults;
    }>(`/api/v1/quiz-sessions/${sessionId}/complete`);
    return response.data.data;
  },

  /**
   * Abandon a quiz session
   */
  async abandonSession(sessionId: string): Promise<void> {
    await api.post(`/api/v1/quiz-sessions/${sessionId}/abandon`);
  },

  /**
   * Get quiz results
   */
  async getResults(sessionId: string): Promise<QuizResults> {
    const response = await api.get<{
      success: boolean;
      data: QuizResults;
    }>(`/api/v1/quiz-sessions/${sessionId}/results`);
    return response.data.data;
  },
};
