import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { StreaksData } from '@/services/analytics.service';
import { Flame, Trophy, Zap, Calendar, Target } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useMemo } from 'react';
import { format, subDays } from 'date-fns';

interface StreakDisplayProps {
  data: StreaksData;
  isLoading?: boolean;
}

const MilestoneProgress = ({
  label,
  current,
  next,
  progress,
  icon: Icon,
  color,
}: {
  label: string;
  current: number;
  next: number;
  progress: number;
  icon: React.ElementType;
  color: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', color)} />
        <span className="text-sm font-medium text-gray-700">{label}</span>
      </div>
      <span className="text-xs text-gray-500">
        {current} / {next}
      </span>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color.replace('text-', 'bg-'))}
        style={{ width: `${Math.min(100, progress)}%` }}
      />
    </div>
  </div>
);

export function StreakDisplay({ data, isLoading }: StreakDisplayProps) {
  // Generate calendar data for last 90 days
  const calendarData = useMemo(() => {
    const today = new Date();
    const days: { date: Date; hasActivity: boolean }[] = [];
    
    for (let i = 89; i >= 0; i--) {
      const date = subDays(today, i);
      const dateStr = format(date, 'yyyy-MM-dd');
      days.push({
        date,
        hasActivity: data.streakDates.includes(dateStr),
      });
    }
    
    return days;
  }, [data.streakDates]);

  // Group by weeks for display (kept for potential future use)
  // const weeks = useMemo(() => {
  //   const result: typeof calendarData[] = [];
  //   let currentWeek: typeof calendarData = [];
  //   
  //   calendarData.forEach((day, index) => {
  //     currentWeek.push(day);
  //     if (currentWeek.length === 7 || index === calendarData.length - 1) {
  //       result.push(currentWeek);
  //       currentWeek = [];
  //     }
  //   });
  //   
  //   return result;
  // }, [calendarData]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity & Streaks</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-500" />
          Activity & Streaks
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gradient-to-br from-orange-50 to-orange-100 p-4 text-center">
            <Flame className="mx-auto h-8 w-8 text-orange-500" />
            <p className="mt-2 text-3xl font-bold text-orange-700">{data.currentStreak}</p>
            <p className="text-xs text-orange-600">Day Streak</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-yellow-50 to-yellow-100 p-4 text-center">
            <Trophy className="mx-auto h-8 w-8 text-yellow-500" />
            <p className="mt-2 text-3xl font-bold text-yellow-700">{data.longestStreak}</p>
            <p className="text-xs text-yellow-600">Best Streak</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 p-4 text-center">
            <Target className="mx-auto h-8 w-8 text-primary-500" />
            <p className="mt-2 text-3xl font-bold text-primary-700">{data.totalQuizzes}</p>
            <p className="text-xs text-primary-600">Total Quizzes</p>
          </div>
          <div className="rounded-lg bg-gradient-to-br from-green-50 to-green-100 p-4 text-center">
            <Zap className="mx-auto h-8 w-8 text-green-500" />
            <p className="mt-2 text-3xl font-bold text-green-700">
              {data.totalQuestionsAnswered.toLocaleString()}
            </p>
            <p className="text-xs text-green-600">Questions</p>
          </div>
        </div>

        {/* Activity Calendar */}
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
            <Calendar className="h-4 w-4" />
            Activity (Last 90 Days)
          </h4>
          <div className="flex flex-wrap gap-1">
            {calendarData.map((day, index) => (
              <div
                key={index}
                className={cn(
                  'h-3 w-3 rounded-sm transition-colors',
                  day.hasActivity
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-gray-100 hover:bg-gray-200'
                )}
                title={`${format(day.date, 'MMM d, yyyy')}${day.hasActivity ? ' - Active' : ''}`}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-end gap-2 text-xs text-gray-500">
            <span>Less</span>
            <div className="h-3 w-3 rounded-sm bg-gray-100" />
            <div className="h-3 w-3 rounded-sm bg-green-300" />
            <div className="h-3 w-3 rounded-sm bg-green-500" />
            <span>More</span>
          </div>
        </div>

        {/* Milestones */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700">Next Milestones</h4>
          <MilestoneProgress
            label="Quizzes"
            current={data.milestones.quizzes.current}
            next={data.milestones.quizzes.next}
            progress={data.milestones.quizzes.progress}
            icon={Target}
            color="text-primary-500"
          />
          <MilestoneProgress
            label="Questions"
            current={data.milestones.questions.current}
            next={data.milestones.questions.next}
            progress={data.milestones.questions.progress}
            icon={Zap}
            color="text-green-500"
          />
          <MilestoneProgress
            label="Streak"
            current={data.milestones.streak.current}
            next={data.milestones.streak.next}
            progress={data.milestones.streak.progress}
            icon={Flame}
            color="text-orange-500"
          />
        </div>
      </CardContent>
    </Card>
  );
}
