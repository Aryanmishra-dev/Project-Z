import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Progress, Card } from '@/components/ui';
import { pdfService } from '@/services/pdf.service';
import { getErrorMessage } from '@/lib/api';
import { formatFileSize } from '@/utils/formatters';
import { MAX_FILE_SIZE, ACCEPTED_FILE_TYPES } from '@/utils/constants';
import { cn } from '@/utils/cn';

interface PDFUploaderProps {
  onSuccess?: () => void;
}

export function PDFUploader({ onSuccess }: PDFUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: pdfService.upload,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdfs'] });
      setSelectedFile(null);
      setUploadProgress(0);
      onSuccess?.();
    },
    onError: (err) => {
      setError(getErrorMessage(err));
    },
  });

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    setError(null);
    
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0];
      if (rejection.errors[0]?.code === 'file-too-large') {
        setError(`File is too large. Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`);
      } else if (rejection.errors[0]?.code === 'file-invalid-type') {
        setError('Invalid file type. Only PDF files are accepted.');
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0] ?? null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: 1,
    noClick: selectedFile !== null,
    noKeyboard: selectedFile !== null,
  });

  const handleUpload = () => {
    if (!selectedFile) return;
    setError(null);
    setUploadProgress(0);
    
    // Simulate progress for UX (actual progress would come from axios config)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    uploadMutation.mutate(selectedFile, {
      onSettled: () => {
        clearInterval(interval);
        setUploadProgress(100);
      },
    });
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setError(null);
    setUploadProgress(0);
  };

  return (
    <Card className="p-6">
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          isDragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-gray-400',
          selectedFile && 'border-solid border-gray-200 bg-gray-50'
        )}
      >
        <input {...getInputProps()} aria-label="Upload PDF file" />

        {selectedFile ? (
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary-100">
                  <FileText className="h-6 w-6 text-primary-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="rounded-full p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
                aria-label="Remove file"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {uploadMutation.isPending && (
              <div className="mt-4">
                <Progress
                  value={uploadProgress}
                  max={100}
                  showValue
                  label="Uploading..."
                />
              </div>
            )}

            {!uploadMutation.isPending && (
              <Button
                onClick={handleUpload}
                className="mt-4 w-full"
                loading={uploadMutation.isPending}
              >
                Upload PDF
              </Button>
            )}
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <Upload className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop your PDF here' : 'Upload a PDF'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Drag and drop or{' '}
              <button
                type="button"
                onClick={open}
                className="font-medium text-primary-600 hover:text-primary-700"
              >
                browse
              </button>
            </p>
            <p className="mt-2 text-xs text-gray-400">
              PDF only, up to {formatFileSize(MAX_FILE_SIZE)}
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-md bg-error-50 p-3 text-sm text-error-700" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </Card>
  );
}
