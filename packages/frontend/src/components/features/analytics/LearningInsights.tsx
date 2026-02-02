import { Clock, Brain, RefreshCw, Zap, Sun, Gauge } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { PatternsData } from '@/services/analytics.service';
import { cn } from '@/utils/cn';

interface LearningInsightsProps {
  data: PatternsData;
  isLoading?: boolean;
}

const InsightCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  color,
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle: string;
  color: string;
}) => (
  <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
    <div className="flex items-start gap-3">
      <div className={cn('rounded-lg p-2', color)}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-gray-500">{title}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
    </div>
  </div>
);

const formatHour = (hour: number): string => {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
};

const formatSeconds = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
};

const getTimeOfDayPeriod = (hour: number): string => {
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Afternoon';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Night';
};

export function LearningInsights({ data, isLoading }: LearningInsightsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Learning Insights</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.bestTimeOfDay || data.optimalQuizLength || data.avgTimePerQuestion > 0;

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Learning Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] flex-col items-center justify-center gap-2">
          <Brain className="h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Not enough data yet</p>
          <p className="text-sm text-gray-400">
            Complete more quizzes to unlock personalized insights
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          Learning Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Best Time of Day */}
          {data.bestTimeOfDay && (
            <InsightCard
              icon={Sun}
              title="Best Study Time"
              value={formatHour(data.bestTimeOfDay.hour)}
              subtitle={`${getTimeOfDayPeriod(data.bestTimeOfDay.hour)} - ${data.bestTimeOfDay.avgScore.toFixed(0)}% avg score`}
              color="bg-yellow-500"
            />
          )}

          {/* Optimal Quiz Length */}
          {data.optimalQuizLength && (
            <InsightCard
              icon={Gauge}
              title="Optimal Quiz Size"
              value={`${data.optimalQuizLength.questionCount} questions`}
              subtitle={`${data.optimalQuizLength.avgScore.toFixed(0)}% avg score`}
              color="bg-blue-500"
            />
          )}

          {/* Average Time per Question */}
          <InsightCard
            icon={Clock}
            title="Avg. Time per Question"
            value={formatSeconds(data.avgTimePerQuestion)}
            subtitle={data.avgTimePerQuestion < 30 ? 'Quick responder!' : 'Thoughtful approach'}
            color="bg-green-500"
          />

          {/* Fastest Completion */}
          {data.fastestCompletionTime > 0 && (
            <InsightCard
              icon={Zap}
              title="Fastest Quiz"
              value={formatSeconds(data.fastestCompletionTime)}
              subtitle="Personal record"
              color="bg-purple-500"
            />
          )}
        </div>

        {/* Retention Section */}
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary-600" />
            <h4 className="font-medium text-primary-900">Retention Analysis</h4>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-primary-700">
                {(data.retention.pdfRetakeRate * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-primary-600">PDF Retake Rate</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary-700">
                {data.retention.avgImprovementOnRetake > 0 ? '+' : ''}
                {data.retention.avgImprovementOnRetake.toFixed(1)}%
              </p>
              <p className="text-xs text-primary-600">Avg. Improvement on Retake</p>
            </div>
          </div>
          {data.retention.avgImprovementOnRetake > 5 && (
            <p className="mt-2 text-center text-sm text-primary-600">
              ✨ Great job! You're improving significantly on retakes.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
