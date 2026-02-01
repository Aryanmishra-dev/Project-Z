import { api } from '@/lib/api';

export interface DashboardStats {
  pdfs: {
    total: number;
    completed: number;
    pending: number;
    failed: number;
    totalQuestions: number;
  };
  quizzes: {
    total: number;
    completed: number;
    averageScore: number;
    totalQuestionsAnswered: number;
    correctAnswers: number;
    accuracy: number;
  };
  recentActivity: {
    lastQuizDate: string | null;
    lastUploadDate: string | null;
    quizzesThisWeek: number;
  };
}

export interface DailyScore {
  date: string;
  avgScore: number;
  quizzes: number;
  totalQuestions: number;
  correctAnswers: number;
}

export interface DifficultyPerformance {
  avgScore: number;
  totalQuestions: number;
  correctAnswers: number;
  quizzes: number;
}

export interface TrendsData {
  dailyScores: DailyScore[];
  byDifficulty: {
    easy: DifficultyPerformance;
    medium: DifficultyPerformance;
    hard: DifficultyPerformance;
  };
  overallTrend: 'improving' | 'stable' | 'declining';
  improvementRate: number;
}

export interface WeakQuestion {
  questionId: string;
  questionText: string;
  pdfFilename: string;
  pdfId: string;
  difficulty: string;
  attempts: number;
  correct: number;
  accuracy: number;
}

export interface WeakAreasData {
  weakQuestions: WeakQuestion[];
  weakDifficulties: string[];
  recommendedPdfs: Array<{
    pdfId: string;
    filename: string;
    weakQuestionCount: number;
    avgAccuracy: number;
  }>;
  totalWeakAreas: number;
}

export interface PatternsData {
  bestTimeOfDay: {
    hour: number;
    avgScore: number;
    quizCount: number;
  } | null;
  optimalQuizLength: {
    questionCount: number;
    avgScore: number;
    quizCount: number;
  } | null;
  retention: {
    pdfRetakeRate: number;
    avgImprovementOnRetake: number;
  };
  avgTimePerQuestion: number;
  fastestCompletionTime: number;
}

export interface StreaksData {
  currentStreak: number;
  longestStreak: number;
  totalQuizzes: number;
  totalQuestionsAnswered: number;
  lastActivityDate: string | null;
  streakDates: string[];
  milestones: {
    quizzes: { current: number; next: number; progress: number };
    questions: { current: number; next: number; progress: number };
    streak: { current: number; next: number; progress: number };
  };
}

export const analyticsService = {
  /**
   * Get dashboard analytics
   */
  async getDashboard(refresh = false): Promise<DashboardStats> {
    const response = await api.get<{
      success: boolean;
      data: DashboardStats;
    }>('/api/v1/analytics/dashboard', { params: { refresh } });
    return response.data.data;
  },

  /**
   * Get performance trends
   */
  async getTrends(refresh = false): Promise<TrendsData> {
    const response = await api.get<{
      success: boolean;
      data: TrendsData;
    }>('/api/v1/analytics/trends', { params: { refresh } });
    return response.data.data;
  },

  /**
   * Get weak areas analysis
   */
  async getWeakAreas(refresh = false): Promise<WeakAreasData> {
    const response = await api.get<{
      success: boolean;
      data: WeakAreasData;
    }>('/api/v1/analytics/weak-areas', { params: { refresh } });
    return response.data.data;
  },

  /**
   * Get learning patterns
   */
  async getPatterns(refresh = false): Promise<PatternsData> {
    const response = await api.get<{
      success: boolean;
      data: PatternsData;
    }>('/api/v1/analytics/patterns', { params: { refresh } });
    return response.data.data;
  },

  /**
   * Get streak data
   */
  async getStreaks(refresh = false): Promise<StreaksData> {
    const response = await api.get<{
      success: boolean;
      data: StreaksData;
    }>('/api/v1/analytics/streaks', { params: { refresh } });
    return response.data.data;
  },

  /**
   * Invalidate analytics cache
   */
  async invalidateCache(): Promise<void> {
    await api.post('/api/v1/analytics/invalidate-cache');
  },
};
