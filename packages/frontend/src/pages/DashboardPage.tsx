import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  HelpCircle,
  Target,
  Clock,
  Upload,
  Play,
  TrendingUp,
} from 'lucide-react';
import { Button, Card, CardContent, Spinner, Badge } from '@/components/ui';
import { StatsCard } from '@/components/features/analytics';
import { QuizConfig } from '@/components/features/quiz';
import { analyticsService } from '@/services';
import { useAuthStore } from '@/stores/authStore';
import { formatRelativeTime } from '@/utils/formatters';
import { ROUTES } from '@/utils/constants';
import { cn } from '@/utils/cn';

export function DashboardPage() {
  const { user } = useAuthStore();
  const [showQuizConfig, setShowQuizConfig] = useState(false);

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => analyticsService.getDashboard(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading dashboard..." />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName?.split(' ')[0] || 'there'}! 👋
          </h1>
          <p className="mt-1 text-gray-500">
            Here's an overview of your learning progress
          </p>
        </div>
        <div className="flex gap-3">
          <Link to={ROUTES.PDFS}>
            <Button variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Upload PDF
            </Button>
          </Link>
          <Button onClick={() => setShowQuizConfig(true)}>
            <Play className="mr-2 h-4 w-4" />
            Take Quiz
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={<FileText className="h-6 w-6" />}
          label="Total PDFs"
          value={stats.pdfs.total}
          variant="primary"
        />
        <StatsCard
          icon={<HelpCircle className="h-6 w-6" />}
          label="Quizzes Taken"
          value={stats.quizzes.total}
          variant="success"
        />
        <StatsCard
          icon={<Target className="h-6 w-6" />}
          label="Avg. Score"
          value={`${Math.round(stats.quizzes.averageScore)}%`}
          variant="warning"
        />
        <StatsCard
          icon={<Clock className="h-6 w-6" />}
          label="Questions Answered"
          value={stats.quizzes.totalQuestionsAnswered}
          variant="default"
        />
      </div>

      {/* Content grid */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <TrendingUp className="h-5 w-5 text-primary-500" />
              Recent Activity
            </h2>
            {!stats.recentActivity.lastQuizDate && !stats.recentActivity.lastUploadDate ? (
              <div className="mt-6 text-center py-8">
                <p className="text-gray-500">No activity yet. Start by uploading a PDF!</p>
                <Link to={ROUTES.PDFS}>
                  <Button className="mt-4">
                    Upload Your First PDF
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {stats.recentActivity.lastQuizDate && (
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100">
                        <HelpCircle className="h-5 w-5 text-success-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Last Quiz</p>
                        <p className="text-sm text-gray-500">
                          {formatRelativeTime(stats.recentActivity.lastQuizDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="success">
                      {stats.recentActivity.quizzesThisWeek} this week
                    </Badge>
                  </div>
                )}
                {stats.recentActivity.lastUploadDate && (
                  <div className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                        <FileText className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">Last Upload</p>
                        <p className="text-sm text-gray-500">
                          {formatRelativeTime(stats.recentActivity.lastUploadDate)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PDF Status Breakdown */}
        <Card>
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">
              PDF Status Breakdown
            </h2>
            <div className="mt-6 space-y-4">
              {([
                { label: 'Completed', value: stats.pdfs.completed, color: 'bg-success-500' },
                { label: 'Pending', value: stats.pdfs.pending, color: 'bg-warning-500' },
                { label: 'Failed', value: stats.pdfs.failed, color: 'bg-error-500' },
              ]).map((item) => {
                const percentage = stats.pdfs.total > 0 ? (item.value / stats.pdfs.total) * 100 : 0;

                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-700">
                        {item.label}
                      </span>
                      <span className="text-gray-500">
                        {item.value}/{stats.pdfs.total} ({Math.round(percentage)}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          item.color
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-col gap-4 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Ready to learn?</h3>
          <p className="mt-1 text-primary-100">
            Upload a new PDF or take a quiz to keep improving.
          </p>
        </div>
        <div className="flex gap-3">
          <Link to={ROUTES.PDFS}>
            <Button className="bg-white text-primary-600 hover:bg-primary-50">
              <Upload className="mr-2 h-4 w-4" />
              Upload PDF
            </Button>
          </Link>
          <Button
            onClick={() => setShowQuizConfig(true)}
            className="border-white text-white hover:bg-primary-500"
          >
            <Play className="mr-2 h-4 w-4" />
            Take Quiz
          </Button>
        </div>
      </div>

      {/* Quiz Config Modal */}
      <QuizConfig
        open={showQuizConfig}
        onOpenChange={setShowQuizConfig}
      />
    </div>
  );
}
