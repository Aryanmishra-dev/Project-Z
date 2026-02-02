import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';

import { QuizInterface } from '@/components/features/quiz';
import { Spinner, Button } from '@/components/ui';
import { quizService } from '@/services';
import { useQuizStore } from '@/stores/quizStore';
import { ROUTES } from '@/utils/constants';

export function QuizPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const clearQuiz = useQuizStore((state) => state.clearQuiz);

  const {
    data: session,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['quiz-session', sessionId],
    queryFn: () => quizService.getSession(sessionId!),
    enabled: !!sessionId,
    staleTime: 0, // Always fetch fresh data
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Loading quiz..." />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-error-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Quiz not found</h2>
        <p className="mt-2 text-gray-500">
          {error instanceof Error ? error.message : 'The quiz session could not be loaded.'}
        </p>
        <Link to={ROUTES.PDFS}>
          <Button className="mt-4" variant="outline" onClick={() => clearQuiz()}>
            Back to PDFs
          </Button>
        </Link>
      </div>
    );
  }

  // Check if quiz is already completed
  if (session.status === 'completed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <h2 className="text-lg font-semibold text-gray-900">Quiz Already Completed</h2>
        <p className="mt-2 text-gray-500">This quiz session has already been completed.</p>
        <div className="mt-4 flex gap-4">
          <Link to={ROUTES.QUIZ_RESULTS(sessionId!)}>
            <Button>View Results</Button>
          </Link>
          <Link to={ROUTES.PDFS}>
            <Button variant="outline" onClick={() => clearQuiz()}>
              Back to PDFs
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return <QuizInterface session={session} />;
}
