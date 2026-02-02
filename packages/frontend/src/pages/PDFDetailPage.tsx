import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Clock,
  HelpCircle,
  Download,
  Trash2,
  Play,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';

import { ProcessingStatus } from '@/components/features/pdf';
import { QuizConfig } from '@/components/features/quiz';
import {
  Button,
  Card,
  CardContent,
  Badge,
  Spinner,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';
import { pdfService } from '@/services';
import { cn } from '@/utils/cn';
import { ROUTES } from '@/utils/constants';
import {
  formatRelativeTime,
  formatFileSize,
  formatCount,
  formatDateTime,
} from '@/utils/formatters';

export function PDFDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(searchParams.get('action') === 'quiz');

  const {
    data: pdf,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['pdf', id],
    queryFn: () => pdfService.getById(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => pdfService.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdfs'] });
      window.location.href = ROUTES.PDFS;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading PDF details..." />
      </div>
    );
  }

  if (isError || !pdf) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-error-400" />
        <h2 className="mt-4 text-lg font-semibold text-gray-900">PDF not found</h2>
        <p className="mt-2 text-gray-500">The PDF you're looking for doesn't exist.</p>
        <Link to={ROUTES.PDFS}>
          <Button className="mt-4" variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to PDFs
          </Button>
        </Link>
      </div>
    );
  }

  const isProcessing = pdf.status === 'processing' || pdf.status === 'pending';
  const isCompleted = pdf.status === 'completed';
  const isFailed = pdf.status === 'failed';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={ROUTES.PDFS}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      {/* PDF Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                  isCompleted ? 'bg-success-100' : isFailed ? 'bg-error-100' : 'bg-primary-100'
                )}
              >
                <FileText
                  className={cn(
                    'h-7 w-7',
                    isCompleted
                      ? 'text-success-600'
                      : isFailed
                        ? 'text-error-600'
                        : 'text-primary-600'
                  )}
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-bold text-gray-900 break-words">
                  {pdf.originalFilename || pdf.filename}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                  <span>{formatFileSize(pdf.fileSize ?? pdf.fileSizeBytes)}</span>
                  {pdf.pageCount && (
                    <>
                      <span>•</span>
                      <span>{formatCount(pdf.pageCount, 'page')}</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{formatRelativeTime(pdf.createdAt)}</span>
                </div>
              </div>
            </div>

            <Badge
              variant={
                pdf.status === 'completed'
                  ? 'success'
                  : pdf.status === 'failed'
                    ? 'error'
                    : pdf.status === 'processing'
                      ? 'info'
                      : 'warning'
              }
              className="text-sm"
            >
              {pdf.status}
            </Badge>
          </div>

          {/* Processing status */}
          {isProcessing && (
            <div className="mt-6 border-t border-gray-100 pt-6">
              <ProcessingStatus pdfId={pdf.id} />
            </div>
          )}

          {/* Error message */}
          {isFailed && pdf.processingError && (
            <div className="mt-6 rounded-lg bg-error-50 border border-error-200 p-4">
              <div className="flex items-center gap-2 text-error-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Processing failed</span>
              </div>
              <p className="mt-1 text-sm text-error-600">{pdf.processingError}</p>
            </div>
          )}

          {/* Stats for completed */}
          {isCompleted && (
            <div className="mt-6 grid gap-4 border-t border-gray-100 pt-6 sm:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <HelpCircle className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Questions</p>
                  <p className="text-lg font-semibold text-gray-900">{pdf.questionCount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Uploaded</p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatDateTime(pdf.createdAt)}
                  </p>
                </div>
              </div>
              {pdf.processingCompletedAt && (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100">
                    <Clock className="h-5 w-5 text-success-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Processed</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDateTime(pdf.processingCompletedAt)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-6">
            {isCompleted && (
              <Button onClick={() => setShowQuizConfig(true)}>
                <Play className="mr-2 h-4 w-4" />
                Start Quiz
              </Button>
            )}
            <Button
              variant="outline"
              onClick={async () => {
                const url = await pdfService.getDownloadUrl(pdf.id);
                window.open(url, '_blank');
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              variant="ghost"
              className="text-error-600 hover:bg-error-50"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete PDF?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{pdf.originalFilename}"? This action cannot be undone
              and all associated questions will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              loading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz Config Modal */}
      <QuizConfig
        open={showQuizConfig}
        onOpenChange={setShowQuizConfig}
        preselectedPdfId={pdf.id}
      />
    </div>
  );
}
