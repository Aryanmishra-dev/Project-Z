import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Flag,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import {
  Button,
  Progress,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { QuestionCard } from './QuestionCard';
import { QuizTimer } from './QuizTimer';
import { quizService } from '@/services';
import {
  useQuizStore,
  selectCurrentQuestion,
  selectProgress,
  selectIsLastQuestion,
  selectIsFirstQuestion,
} from '@/stores/quizStore';
import { ROUTES } from '@/utils/constants';
import { cn } from '@/utils/cn';
import type { QuizSessionWithDetails } from '@/types';

interface QuizInterfaceProps {
  session: QuizSessionWithDetails;
}

export function QuizInterface({ session }: QuizInterfaceProps) {
  const navigate = useNavigate();
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showAbandonDialog, setShowAbandonDialog] = useState(false);

  const {
    currentQuestionIndex,
    answers,
    markedForReview,
    timeRemaining,
    setAnswer,
    toggleMarkForReview,
    goToQuestion,
    nextQuestion,
    previousQuestion,
    decrementTime,
    setSubmitting,
    startQuiz,
  } = useQuizStore();

  // Initialize quiz if needed
  useState(() => {
    if (!useQuizStore.getState().currentSession) {
      startQuiz(session);
    }
  });

  const currentQuestion = useQuizStore(selectCurrentQuestion);
  const progress = useQuizStore(selectProgress);
  const isLastQuestion = useQuizStore(selectIsLastQuestion);
  const isFirstQuestion = useQuizStore(selectIsFirstQuestion);

  const questions = session.questions;

  // Submit answer mutation
  const submitAnswerMutation = useMutation({
    mutationFn: ({ questionId, optionIndex }: { questionId: string; optionIndex: number }) =>
      quizService.submitAnswer(session.id, {
        questionId,
        selectedOptionIndex: optionIndex,
      }),
  });

  // Complete quiz mutation
  const completeQuizMutation = useMutation({
    mutationFn: () => quizService.completeSession(session.id),
    onSuccess: () => {
      navigate(ROUTES.QUIZ_RESULTS(session.id));
    },
  });

  // Abandon quiz mutation
  const abandonQuizMutation = useMutation({
    mutationFn: () => quizService.abandonSession(session.id),
    onSuccess: () => {
      navigate(ROUTES.PDFS);
    },
  });

  const handleSelectAnswer = useCallback(
    (optionIndex: number) => {
      if (!currentQuestion) return;
      setAnswer(currentQuestion.id, optionIndex);

      // Submit answer to server
      submitAnswerMutation.mutate({
        questionId: currentQuestion.id,
        optionIndex,
      });
    },
    [currentQuestion, setAnswer, submitAnswerMutation]
  );

  const handleSubmit = () => {
    setSubmitting(true);
    completeQuizMutation.mutate();
  };

  const handleAbandon = () => {
    abandonQuizMutation.mutate();
  };

  const handleTimerTick = useCallback(() => {
    decrementTime();
  }, [decrementTime]);

  if (!currentQuestion) {
    return null;
  }

  const unansweredCount = questions.length - progress.answered;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAbandonDialog(true)}
              className="text-gray-500"
            >
              Exit Quiz
            </Button>
          </div>

          <div className="flex items-center gap-4">
            {timeRemaining !== null && (
              <QuizTimer
                seconds={timeRemaining}
                onTick={handleTimerTick}
              />
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowSubmitDialog(true)}
            >
              Submit Quiz
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <Progress
          value={progress.percentage}
          max={100}
          className="h-1 rounded-none"
        />
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_200px]">
          {/* Question area */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <QuestionCard
              question={currentQuestion}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              selectedOption={answers[currentQuestion.id]}
              onSelect={handleSelectAnswer}
            />

            {/* Navigation */}
            <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-6">
              <Button
                variant="outline"
                onClick={previousQuestion}
                disabled={isFirstQuestion}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Previous
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleMarkForReview(currentQuestion.id)}
                className={cn(
                  markedForReview.has(currentQuestion.id) && 'text-warning-600'
                )}
              >
                <Flag className="mr-1 h-4 w-4" />
                {markedForReview.has(currentQuestion.id) ? 'Marked' : 'Mark for review'}
              </Button>

              {isLastQuestion ? (
                <Button variant="primary" onClick={() => setShowSubmitDialog(true)}>
                  Submit Quiz
                </Button>
              ) : (
                <Button onClick={nextQuestion}>
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Question navigator */}
          <div className="rounded-xl bg-white p-4 shadow-sm h-fit lg:sticky lg:top-20">
            <h3 className="mb-4 text-sm font-medium text-gray-700">Questions</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, index) => {
                const isAnswered = answers[q.id] !== undefined;
                const isCurrent = index === currentQuestionIndex;
                const isMarked = markedForReview.has(q.id);

                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(index)}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                      isCurrent && 'ring-2 ring-primary-500',
                      isAnswered && !isCurrent && 'bg-success-100 text-success-700',
                      !isAnswered && !isCurrent && 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    )}
                    aria-label={`Question ${index + 1}${isAnswered ? ', answered' : ', unanswered'}${isMarked ? ', marked for review' : ''}`}
                  >
                    {index + 1}
                    {isMarked && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-warning-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-success-100" />
                Answered ({progress.answered})
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded bg-gray-100" />
                Unanswered ({unansweredCount})
              </div>
              {markedForReview.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="relative h-4 w-4 rounded bg-gray-100">
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-warning-500" />
                  </span>
                  Marked ({markedForReview.size})
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Submit confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-success-500" />
              Submit Quiz?
            </DialogTitle>
            <DialogDescription>
              {unansweredCount > 0 ? (
                <span className="text-warning-600">
                  You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.
                </span>
              ) : (
                'You have answered all questions.'
              )}
              <br />
              Are you sure you want to submit your quiz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
              Continue Quiz
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={completeQuizMutation.isPending}
            >
              Submit Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Abandon confirmation dialog */}
      <Dialog open={showAbandonDialog} onOpenChange={setShowAbandonDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning-500" />
              Exit Quiz?
            </DialogTitle>
            <DialogDescription>
              Your progress will be lost. Are you sure you want to exit?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAbandonDialog(false)}>
              Continue Quiz
            </Button>
            <Button
              variant="destructive"
              onClick={handleAbandon}
              loading={abandonQuizMutation.isPending}
            >
              Exit Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
