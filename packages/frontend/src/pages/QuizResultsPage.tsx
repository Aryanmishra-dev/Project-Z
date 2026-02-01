import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { Spinner, Button } from '@/components/ui';
import { QuizResults } from '@/components/features/quiz';
import { quizService } from '@/services';
import { useQuizStore } from '@/stores/quizStore';
import { useEffect } from 'react';
import { ROUTES } from '@/utils/constants';

export function QuizResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const clearQuiz = useQuizStore((state) => state.clearQuiz);

  // Clear quiz state when viewing results
  useEffect(() => {
    clearQuiz();
  }, [clearQuiz]);

  const { data: results, isLoading, isError, error } = useQuery({
    queryKey: ['quiz-results', sessionId],
    queryFn: () => quizService.getResults(sessionId!),
    enabled: !!sessionId,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size="lg" label="Loading results..." />
      </div>
    );
  }

  if (isError || !results) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <AlertCircle className="h-12 w-12 text-error-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Results not found</h2>
        <p className="mt-2 text-gray-500">
          {error instanceof Error ? error.message : 'The quiz results could not be loaded.'}
        </p>
        <Link to={ROUTES.PDFS}>
          <Button className="mt-4" variant="outline">
            Back to PDFs
          </Button>
        </Link>
      </div>
    );
  }

  return <QuizResults results={results} />;
}
