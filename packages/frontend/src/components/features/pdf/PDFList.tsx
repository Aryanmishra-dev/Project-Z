import { useQuery } from '@tanstack/react-query';
import { FileText, AlertCircle } from 'lucide-react';
import { PDFCard } from './PDFCard';
import { Spinner, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { pdfService } from '@/services/pdf.service';
import { usePDFStore } from '@/stores/pdfStore';
import { DEFAULT_PAGE_SIZE } from '@/utils/constants';
import type { PDFStatus } from '@/types';

interface PDFListProps {
  onUploadClick?: () => void;
}

export function PDFList({ onUploadClick }: PDFListProps) {
  const { filters, currentPage, setFilters, setCurrentPage } = usePDFStore();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pdfs', filters, currentPage],
    queryFn: () =>
      pdfService.list({
        page: currentPage,
        limit: DEFAULT_PAGE_SIZE,
        status: filters.status === 'all' ? undefined : filters.status,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }),
  });

  const pdfs = data?.pdfs ?? [];
  const pagination = data?.pagination;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" label="Loading PDFs..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-error-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Failed to load PDFs</h3>
        <p className="mt-1 text-sm text-gray-500">
          {error instanceof Error ? error.message : 'An error occurred'}
        </p>
        <Button onClick={() => refetch()} className="mt-4" variant="outline">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Select
            value={filters.status}
            onValueChange={(value) => setFilters({ status: value as PDFStatus | 'all' })}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split('-') as [typeof filters.sortBy, typeof filters.sortOrder];
              setFilters({ sortBy, sortOrder });
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest first</SelectItem>
              <SelectItem value="createdAt-asc">Oldest first</SelectItem>
              <SelectItem value="originalFilename-asc">Name A-Z</SelectItem>
              <SelectItem value="originalFilename-desc">Name Z-A</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {pagination && (
          <p className="text-sm text-gray-500">
            Showing {pdfs.length} of {pagination.total} PDFs
          </p>
        )}
      </div>

      {/* PDF grid */}
      {pdfs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12">
          <FileText className="h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">No PDFs found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {filters.status !== 'all'
              ? 'Try changing the filter or upload a new PDF'
              : 'Upload your first PDF to get started'}
          </p>
          {onUploadClick && (
            <Button onClick={onUploadClick} className="mt-4">
              Upload PDF
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pdfs.map((pdf) => (
            <PDFCard key={pdf.id} pdf={pdf} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="px-4 text-sm text-gray-600">
            Page {currentPage} of {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
