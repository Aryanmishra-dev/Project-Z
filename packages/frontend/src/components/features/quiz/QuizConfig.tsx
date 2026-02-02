import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings, Play } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
} from '@/components/ui';
import { getErrorMessage } from '@/lib/api';
import { quizService, pdfService } from '@/services';
import type { Difficulty } from '@/types';
import {
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  DEFAULT_QUESTION_COUNT,
  ROUTES,
  DIFFICULTY_CONFIG,
} from '@/utils/constants';

interface QuizConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedPdfId?: string;
}

export function QuizConfig({ open, onOpenChange, preselectedPdfId }: QuizConfigProps) {
  const navigate = useNavigate();
  const [selectedPdfId, setSelectedPdfId] = useState(preselectedPdfId || '');
  const [questionCount, setQuestionCount] = useState(DEFAULT_QUESTION_COUNT);
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  // Fetch completed PDFs
  const { data: pdfData, isLoading: pdfsLoading } = useQuery({
    queryKey: ['pdfs', 'completed'],
    queryFn: () => pdfService.list({ status: 'completed', limit: 100 }),
    enabled: open,
  });

  // Fetch question counts for selected PDF
  const { data: countsData, isLoading: countsLoading } = useQuery({
    queryKey: ['question-counts', selectedPdfId],
    queryFn: () => quizService.getQuestionCounts(selectedPdfId),
    enabled: !!selectedPdfId,
  });

  const createSessionMutation = useMutation({
    mutationFn: quizService.createSession,
    onSuccess: (session) => {
      onOpenChange(false);
      navigate(ROUTES.QUIZ(session.id));
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const handleStart = () => {
    if (!selectedPdfId) {
      setError('Please select a PDF');
      return;
    }
    setError(null);
    createSessionMutation.mutate({
      pdfId: selectedPdfId,
      questionCount,
      difficulty: difficulty === 'all' ? undefined : difficulty,
    });
  };

  const availableQuestions = countsData
    ? difficulty === 'all'
      ? countsData.total
      : countsData.byDifficulty[difficulty] || 0
    : 0;

  const pdfs = pdfData?.pdfs ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Quiz Settings
          </DialogTitle>
          <DialogDescription>Configure your quiz settings before starting</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-error-50 p-3 text-sm text-error-700" role="alert">
              {error}
            </div>
          )}

          {/* PDF Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Select PDF</label>
            {pdfsLoading ? (
              <Spinner size="sm" />
            ) : pdfs.length === 0 ? (
              <p className="text-sm text-gray-500">
                No completed PDFs available. Upload and process a PDF first.
              </p>
            ) : (
              <Select value={selectedPdfId} onValueChange={setSelectedPdfId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a PDF" />
                </SelectTrigger>
                <SelectContent>
                  {pdfs.map((pdf) => (
                    <SelectItem key={pdf.id} value={pdf.id}>
                      {pdf.originalFilename}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Difficulty Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Difficulty</label>
            <Select
              value={difficulty}
              onValueChange={(value) => setDifficulty(value as Difficulty | 'all')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="easy">{DIFFICULTY_CONFIG.easy.label}</SelectItem>
                <SelectItem value="medium">{DIFFICULTY_CONFIG.medium.label}</SelectItem>
                <SelectItem value="hard">{DIFFICULTY_CONFIG.hard.label}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Question Count */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Number of Questions</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={MIN_QUESTIONS}
                max={Math.min(MAX_QUESTIONS, availableQuestions || MAX_QUESTIONS)}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="flex-1 accent-primary-600"
                disabled={!selectedPdfId || countsLoading}
              />
              <span className="w-12 text-center text-sm font-medium">{questionCount}</span>
            </div>
            {selectedPdfId && (
              <p className="text-xs text-gray-500">
                {countsLoading ? 'Loading...' : `${availableQuestions} questions available`}
              </p>
            )}
          </div>

          {/* Preview */}
          {selectedPdfId && countsData && !countsLoading && (
            <div className="rounded-lg bg-gray-50 p-3">
              <h4 className="text-sm font-medium text-gray-700">Questions by Difficulty</h4>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-success-50 p-2">
                  <div className="font-medium text-success-700">Easy</div>
                  <div className="text-success-600">{countsData.byDifficulty.easy || 0}</div>
                </div>
                <div className="rounded bg-warning-50 p-2">
                  <div className="font-medium text-warning-700">Medium</div>
                  <div className="text-warning-600">{countsData.byDifficulty.medium || 0}</div>
                </div>
                <div className="rounded bg-error-50 p-2">
                  <div className="font-medium text-error-700">Hard</div>
                  <div className="text-error-600">{countsData.byDifficulty.hard || 0}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleStart}
            loading={createSessionMutation.isPending}
            disabled={!selectedPdfId || availableQuestions === 0}
          >
            <Play className="mr-2 h-4 w-4" />
            Start Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
