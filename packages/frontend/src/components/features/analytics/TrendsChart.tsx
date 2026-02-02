import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { TrendsData } from '@/services/analytics.service';
import { cn } from '@/utils/cn';
import { formatDate } from '@/utils/formatters';

interface TrendsChartProps {
  data: TrendsData;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
        <p className="text-sm font-medium text-gray-900">{formatDate(label, 'MMM d, yyyy')}</p>
        <p className="text-sm text-primary-600">
          Avg Score: <span className="font-semibold">{data?.avgScore?.toFixed(1)}%</span>
        </p>
        <p className="text-xs text-gray-500">
          {data?.quizzes} {data?.quizzes === 1 ? 'quiz' : 'quizzes'} • {data?.totalQuestions}{' '}
          questions
        </p>
      </div>
    );
  }
  return null;
};

const TrendIndicator = ({ trend, rate }: { trend: string; rate: number }) => {
  const icons = {
    improving: TrendingUp,
    declining: TrendingDown,
    stable: Minus,
  };
  const colors = {
    improving: 'text-green-600 bg-green-50',
    declining: 'text-red-600 bg-red-50',
    stable: 'text-gray-600 bg-gray-50',
  };
  const Icon = icons[trend as keyof typeof icons] || Minus;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        colors[trend as keyof typeof colors]
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="capitalize">{trend}</span>
      {rate !== 0 && (
        <span className="flex items-center">
          ({rate > 0 ? '+' : ''}
          {rate.toFixed(1)}%)
        </span>
      )}
    </div>
  );
};

export function TrendsChart({ data, isLoading }: TrendsChartProps) {
  const chartData = useMemo(() => {
    return data.dailyScores.map((item) => ({
      ...item,
      formattedDate: formatDate(item.date, 'MMM d'),
    }));
  }, [data.dailyScores]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </CardContent>
      </Card>
    );
  }

  if (data.dailyScores.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] flex-col items-center justify-center gap-2">
          <TrendingUp className="h-12 w-12 text-gray-300" />
          <p className="text-gray-500">No trend data yet</p>
          <p className="text-sm text-gray-400">Take quizzes to see your performance over time</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Performance Trends (Last 30 Days)</CardTitle>
        <TrendIndicator trend={data.overallTrend} rate={data.improvementRate} />
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="formattedDate"
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                axisLine={{ stroke: '#d1d5db' }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                tickLine={{ stroke: '#d1d5db' }}
                axisLine={{ stroke: '#d1d5db' }}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="avgScore"
                name="Average Score"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={{ r: 3, fill: '#4f46e5', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Difficulty Breakdown */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          {(['easy', 'medium', 'hard'] as const).map((difficulty) => {
            const perfData = data.byDifficulty[difficulty];
            const accuracy =
              perfData.totalQuestions > 0
                ? (perfData.correctAnswers / perfData.totalQuestions) * 100
                : 0;

            return (
              <div
                key={difficulty}
                className={cn(
                  'rounded-lg p-3 text-center',
                  difficulty === 'easy' && 'bg-green-50',
                  difficulty === 'medium' && 'bg-yellow-50',
                  difficulty === 'hard' && 'bg-red-50'
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {difficulty}
                </p>
                <p
                  className={cn(
                    'text-2xl font-bold',
                    difficulty === 'easy' && 'text-green-700',
                    difficulty === 'medium' && 'text-yellow-700',
                    difficulty === 'hard' && 'text-red-700'
                  )}
                >
                  {accuracy.toFixed(0)}%
                </p>
                <p className="text-xs text-gray-500">
                  {perfData.correctAnswers}/{perfData.totalQuestions} correct
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
