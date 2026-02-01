import { Link } from 'react-router-dom';
import { FileText, Clock, HelpCircle, Trash2, Play } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, Button, Badge } from '@/components/ui';
import { ProcessingStatus } from './ProcessingStatus';
import { pdfService } from '@/services/pdf.service';
import { formatRelativeTime, formatFileSize, formatCount } from '@/utils/formatters';
import { ROUTES } from '@/utils/constants';
import type { PDF } from '@/types';
import { cn } from '@/utils/cn';

interface PDFCardProps {
  pdf: PDF;
  showActions?: boolean;
}

export function PDFCard({ pdf, showActions = true }: PDFCardProps) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => pdfService.delete(pdf.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdfs'] });
    },
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this PDF? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  const isProcessing = pdf.status === 'processing' || pdf.status === 'pending';
  const isCompleted = pdf.status === 'completed';
  const isFailed = pdf.status === 'failed';

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              isCompleted ? 'bg-success-100' : isFailed ? 'bg-error-100' : 'bg-primary-100'
            )}>
              <FileText className={cn(
                'h-5 w-5',
                isCompleted ? 'text-success-600' : isFailed ? 'text-error-600' : 'text-primary-600'
              )} />
            </div>
            <div className="min-w-0">
              <Link
                to={ROUTES.PDF_DETAIL(pdf.id)}
                className="block truncate font-medium text-gray-900 hover:text-primary-600"
                title={pdf.originalFilename || pdf.filename}
              >
                {pdf.originalFilename || pdf.filename}
              </Link>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{formatFileSize(pdf.fileSize ?? pdf.fileSizeBytes)}</span>
                {pdf.pageCount && (
                  <>
                    <span>•</span>
                    <span>{formatCount(pdf.pageCount, 'page')}</span>
                  </>
                )}
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
          >
            {pdf.status}
          </Badge>
        </div>

        {/* Processing status */}
        {isProcessing && (
          <div className="mt-4">
            <ProcessingStatus pdfId={pdf.id} />
          </div>
        )}

        {/* Error message */}
        {isFailed && pdf.processingError && (
          <div className="mt-4 rounded-md bg-error-50 p-2 text-sm text-error-700">
            {pdf.processingError}
          </div>
        )}

        {/* Stats for completed */}
        {isCompleted && (
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-gray-600">
              <HelpCircle className="h-4 w-4" />
              {formatCount(pdf.questionCount, 'question')}
            </div>
            <div className="flex items-center gap-1.5 text-gray-500">
              <Clock className="h-4 w-4" />
              {formatRelativeTime(pdf.createdAt)}
            </div>
          </div>
        )}

        {/* Actions */}
        {showActions && (
          <div className="mt-4 flex items-center gap-2 border-t border-gray-100 pt-4">
            {isCompleted && (
              <Link to={`${ROUTES.PDFS}/${pdf.id}?action=quiz`} className="flex-1">
                <Button variant="primary" size="sm" className="w-full">
                  <Play className="mr-1.5 h-4 w-4" />
                  Start Quiz
                </Button>
              </Link>
            )}
            <Link to={ROUTES.PDF_DETAIL(pdf.id)}>
              <Button variant="outline" size="sm">
                View
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
              aria-label="Delete PDF"
            >
              <Trash2 className="h-4 w-4 text-gray-500" />
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
