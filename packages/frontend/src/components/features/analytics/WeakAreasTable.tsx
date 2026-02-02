import { AlertTriangle, BookOpen, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from '@/components/ui';
import { WeakAreasData } from '@/services/analytics.service';
import { cn } from '@/utils/cn';

interface WeakAreasTableProps {
  data: WeakAreasData;
  isLoading?: boolean;
}

const DifficultyBadge = ({ difficulty }: { difficulty: string }) => {
  const colors = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  };

  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium capitalize',
        colors[difficulty as keyof typeof colors] || 'bg-gray-100 text-gray-700'
      )}
    >
      {difficulty}
    </span>
  );
};

export function WeakAreasTable({ data, isLoading }: WeakAreasTableProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            Areas for Improvement
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-[200px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" />
        </CardContent>
      </Card>
    );
  }

  if (data.weakQuestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-500" />
            Areas for Improvement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-green-100 p-3">
              <AlertTriangle className="h-6 w-6 text-green-600" />
            </div>
            <p className="mt-3 text-gray-700">No weak areas identified!</p>
            <p className="text-sm text-gray-500">
              Keep taking quizzes to track your improvement areas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning-500" />
          Areas for Improvement
          <Badge variant="outline" className="ml-auto">
            {data.totalWeakAreas} items
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weak Difficulties */}
        {data.weakDifficulties.length > 0 && (
          <div className="rounded-lg bg-red-50 p-4">
            <h4 className="text-sm font-medium text-red-800">
              Struggling with these difficulty levels:
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.weakDifficulties.map((diff) => (
                <DifficultyBadge key={diff} difficulty={diff} />
              ))}
            </div>
          </div>
        )}

        {/* Weak Questions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Questions to Review</h4>
          <div className="max-h-[300px] space-y-2 overflow-y-auto">
            {data.weakQuestions.slice(0, 10).map((question) => (
              <div
                key={question.questionId}
                className="rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex-1 text-sm text-gray-700 line-clamp-2">
                    {question.questionText}
                  </p>
                  <Badge
                    variant={question.accuracy >= 50 ? 'warning' : 'error'}
                    className="shrink-0"
                  >
                    {question.accuracy}%
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                  <span className="truncate">{question.pdfFilename}</span>
                  <DifficultyBadge difficulty={question.difficulty} />
                  <span>
                    {question.correct}/{question.attempts} correct
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended PDFs to Review */}
        {data.recommendedPdfs.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Recommended PDFs to Review</h4>
            <div className="space-y-2">
              {data.recommendedPdfs.map((pdf) => (
                <div
                  key={pdf.pdfId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-700">{pdf.filename}</p>
                      <p className="text-xs text-gray-500">
                        {pdf.weakQuestionCount} weak questions • {pdf.avgAccuracy.toFixed(0)}%
                        accuracy
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/pdfs/${pdf.pdfId}`)}
                    className="shrink-0"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
