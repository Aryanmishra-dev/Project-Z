import { Link } from 'react-router-dom';
import { Trophy, Clock, Target, RefreshCw, BarChart3, ArrowLeft } from 'lucide-react';
import { Button, Card, CardContent, Badge, Progress } from '@/components/ui';
import { QuestionCard } from './QuestionCard';
import { formatDuration, formatScore } from '@/utils/formatters';
import { getPerformanceBadge, DIFFICULTY_CONFIG, ROUTES } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { QuizResults as QuizResultsType } from '@/types';

interface QuizResultsProps {
  results: QuizResultsType;
}

export function QuizResults({ results }: QuizResultsProps) {
  const { session, questions, breakdown } = results;
  const scorePercentage = session.score ?? 0;
  const performanceBadge = getPerformanceBadge(scorePercentage);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Hero section */}
        <Card className={cn('mb-8 overflow-hidden', performanceBadge.bgColor, performanceBadge.borderColor)}>
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md">
              <Trophy className={cn('h-10 w-10', performanceBadge.color)} />
            </div>
            <div className={cn('text-5xl font-bold', performanceBadge.color)}>
              {formatScore(scorePercentage)}
            </div>
            <Badge className="mt-2" variant={
              performanceBadge.label === 'Excellent' ? 'success' :
              performanceBadge.label === 'Good' ? 'info' : 'warning'
            }>
              {performanceBadge.label}
            </Badge>
            <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-1.5">
                <Target className="h-4 w-4" />
                {session.correctAnswers}/{session.totalQuestions} correct
              </div>
              {session.timeSpentSeconds && (
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDuration(session.timeSpentSeconds)}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Breakdown by difficulty */}
        <Card className="mb-8">
          <CardContent className="py-6">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Performance by Difficulty
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {(['easy', 'medium', 'hard'] as const).map((diff) => {
                const data = breakdown[diff];
                const percentage = data.total > 0 ? (data.correct / data.total) * 100 : 0;
                const config = DIFFICULTY_CONFIG[diff];

                return (
                  <div key={diff} className="rounded-lg bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={
                        diff === 'easy' ? 'success' : diff === 'medium' ? 'warning' : 'error'
                      }>
                        {config.label}
                      </Badge>
                      <span className="text-sm font-medium text-gray-700">
                        {data.correct}/{data.total}
                      </span>
                    </div>
                    <Progress
                      value={percentage}
                      max={100}
                      variant={
                        percentage >= 70 ? 'success' : percentage >= 40 ? 'warning' : 'error'
                      }
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Question review */}
        <Card className="mb-8">
          <CardContent className="py-6">
            <h3 className="mb-6 text-lg font-semibold text-gray-900">
              Question Review
            </h3>
            <div className="space-y-8">
              {questions.map((question, index) => {
                const userAnswer = question.userAnswer;
                const isCorrect = userAnswer?.isCorrect ?? false;

                return (
                  <div
                    key={question.id}
                    className={cn(
                      'rounded-lg border-2 p-4',
                      isCorrect ? 'border-success-200 bg-success-50/30' : 'border-error-200 bg-error-50/30'
                    )}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-500">
                        Question {index + 1}
                      </span>
                      <Badge variant={isCorrect ? 'success' : 'error'}>
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Badge>
                    </div>
                    <QuestionCard
                      question={question}
                      questionNumber={index + 1}
                      totalQuestions={questions.length}
                      selectedOption={userAnswer?.selectedOptionIndex ?? undefined}
                      onSelect={() => {}}
                      showAnswer
                      disabled
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link to={ROUTES.PDF_DETAIL(session.pdfId)}>
            <Button variant="outline" className="w-full sm:w-auto">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retake Quiz
            </Button>
          </Link>
          <Link to={ROUTES.ANALYTICS}>
            <Button variant="outline" className="w-full sm:w-auto">
              <BarChart3 className="mr-2 h-4 w-4" />
              View Analytics
            </Button>
          </Link>
          <Link to={ROUTES.PDFS}>
            <Button className="w-full sm:w-auto">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to PDFs
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
