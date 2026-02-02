import { useQuery } from '@tanstack/react-query';
import { FileText, HelpCircle, Target, Clock, CheckCircle2 } from 'lucide-react';

import {
  StatsCard,
  TrendsChart,
  WeakAreasTable,
  StreakDisplay,
  LearningInsights,
} from '@/components/features/analytics';
import { Spinner, Badge } from '@/components/ui';
import { analyticsService, TrendsData, WeakAreasData, PatternsData, StreaksData } from '@/services';

export function AnalyticsPage() {
  // Dashboard stats
  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsService.getDashboard(),
  });

  // Trends
  const { data: trendsData, isLoading: trendsLoading } = useQuery({
    queryKey: ['analytics-trends'],
    queryFn: () => analyticsService.getTrends(),
  });

  // Weak areas
  const { data: weakAreasData, isLoading: weakAreasLoading } = useQuery({
    queryKey: ['analytics-weak-areas'],
    queryFn: () => analyticsService.getWeakAreas(),
  });

  // Patterns
  const { data: patternsData, isLoading: patternsLoading } = useQuery({
    queryKey: ['analytics-patterns'],
    queryFn: () => analyticsService.getPatterns(),
  });

  // Streaks
  const { data: streaksData, isLoading: streaksLoading } = useQuery({
    queryKey: ['analytics-streaks'],
    queryFn: () => analyticsService.getStreaks(),
  });

  const isLoading = dashboardLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading analytics..." />
      </div>
    );
  }

  // Default empty data
  const dashboard = dashboardData || {
    pdfs: { total: 0, completed: 0, pending: 0, failed: 0, totalQuestions: 0 },
    quizzes: {
      total: 0,
      completed: 0,
      averageScore: 0,
      totalQuestionsAnswered: 0,
      correctAnswers: 0,
      accuracy: 0,
    },
    recentActivity: { lastQuizDate: null, lastUploadDate: null, quizzesThisWeek: 0 },
  };

  const trends: TrendsData = trendsData || {
    dailyScores: [],
    byDifficulty: {
      easy: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
      medium: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
      hard: { avgScore: 0, totalQuestions: 0, correctAnswers: 0, quizzes: 0 },
    },
    overallTrend: 'stable',
    improvementRate: 0,
  };

  const weakAreas: WeakAreasData = weakAreasData || {
    weakQuestions: [],
    weakDifficulties: [],
    recommendedPdfs: [],
    totalWeakAreas: 0,
  };

  const patterns: PatternsData = patternsData || {
    bestTimeOfDay: null,
    optimalQuizLength: null,
    retention: { pdfRetakeRate: 0, avgImprovementOnRetake: 0 },
    avgTimePerQuestion: 0,
    fastestCompletionTime: 0,
  };

  const streaks: StreaksData = streaksData || {
    currentStreak: 0,
    longestStreak: 0,
    totalQuizzes: 0,
    totalQuestionsAnswered: 0,
    lastActivityDate: null,
    streakDates: [],
    milestones: {
      quizzes: { current: 0, next: 10, progress: 0 },
      questions: { current: 0, next: 100, progress: 0 },
      streak: { current: 0, next: 7, progress: 0 },
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-gray-500">
            Track your learning progress and identify areas for improvement
          </p>
        </div>
        {dashboard.recentActivity.quizzesThisWeek > 0 && (
          <Badge variant="success" className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {dashboard.recentActivity.quizzesThisWeek} quizzes this week
          </Badge>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<FileText className="h-6 w-6" />}
          label="PDFs Uploaded"
          value={dashboard.pdfs.total}
          subValue={`${dashboard.pdfs.completed} processed`}
          variant="primary"
        />
        <StatsCard
          icon={<HelpCircle className="h-6 w-6" />}
          label="Quizzes Completed"
          value={dashboard.quizzes.completed}
          subValue={`${dashboard.quizzes.totalQuestionsAnswered} questions`}
          variant="success"
        />
        <StatsCard
          icon={<Target className="h-6 w-6" />}
          label="Average Score"
          value={`${Math.round(dashboard.quizzes.averageScore)}%`}
          subValue={`${dashboard.quizzes.accuracy.toFixed(0)}% accuracy`}
          variant="warning"
        />
        <StatsCard
          icon={<Clock className="h-6 w-6" />}
          label="Questions Generated"
          value={dashboard.pdfs.totalQuestions}
          variant="default"
        />
      </div>

      {/* Streaks & Activity */}
      <StreakDisplay data={streaks} isLoading={streaksLoading} />

      {/* Trends & Weak Areas */}
      <div className="grid gap-8 lg:grid-cols-2">
        <TrendsChart data={trends} isLoading={trendsLoading} />
        <WeakAreasTable data={weakAreas} isLoading={weakAreasLoading} />
      </div>

      {/* Learning Insights */}
      <LearningInsights data={patterns} isLoading={patternsLoading} />
    </div>
  );
}
