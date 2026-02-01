export type PDFStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type ProcessingStep = 'extracting' | 'chunking' | 'generating' | 'validating' | 'completed';

export interface PDF {
  id: string;
  userId: string;
  filename: string;
  filePath: string;
  fileSizeBytes: number;
  pageCount: number | null;
  status: PDFStatus;
  processingStartedAt: string | null;
  processingCompletedAt: string | null;
  errorMessage: string | null;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
  // Alias fields for backwards compatibility
  originalFilename?: string;
  fileSize?: number;
  processingError?: string;
}

export interface PDFWithStats extends PDF {
  _count?: {
    questions: number;
  };
}

export interface UploadProgress {
  pdfId: string;
  progress: number;
  step: ProcessingStep;
  message: string;
}

export interface PDFListResponse {
  success: boolean;
  data: {
    pdfs: PDF[];
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface PDFUploadResponse {
  success: boolean;
  data: {
    pdf: PDF;
    jobId: string;
  };
  message: string;
}
