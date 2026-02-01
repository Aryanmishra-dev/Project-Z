import { api } from '@/lib/api';
import type { 
  PDF,
  PDFListResponse, 
  PDFUploadResponse,
  PDFWithStats 
} from '@/types';

export interface PDFListParams {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Transform PDF data from backend format to frontend format
 * Maps: filename -> originalFilename, fileSizeBytes -> fileSize, errorMessage -> processingError
 */
function transformPdf<T extends Partial<PDF>>(pdf: T): T {
  return {
    ...pdf,
    originalFilename: pdf.filename || pdf.originalFilename,
    fileSize: pdf.fileSizeBytes || pdf.fileSize,
    processingError: pdf.errorMessage || pdf.processingError,
  };
}

export const pdfService = {
  /**
   * Upload a new PDF file
   */
  async upload(file: File): Promise<PDFUploadResponse['data']> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<PDFUploadResponse>('/api/v1/pdfs', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const data = response.data.data;
    return {
      ...data,
      pdf: transformPdf(data.pdf),
    };
  },

  /**
   * Get list of user's PDFs
   */
  async list(params: PDFListParams = {}): Promise<PDFListResponse['data']> {
    const response = await api.get<PDFListResponse>('/api/v1/pdfs', { params });
    const data = response.data.data;
    return {
      ...data,
      pdfs: data.pdfs.map(transformPdf),
    };
  },

  /**
   * Get a single PDF by ID
   */
  async getById(id: string): Promise<PDFWithStats> {
    const response = await api.get<{ success: boolean; data: PDFWithStats }>(
      `/api/v1/pdfs/${id}`
    );
    return transformPdf(response.data.data);
  },

  /**
   * Get PDF processing status
   */
  async getStatus(id: string): Promise<{ status: string; progress?: number; step?: string }> {
    const response = await api.get<{ 
      success: boolean; 
      data: { status: string; progress?: number; step?: string } 
    }>(`/api/v1/pdfs/${id}/status`);
    return response.data.data;
  },

  /**
   * Delete a PDF
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/api/v1/pdfs/${id}`);
  },

  /**
   * Cancel PDF processing
   */
  async cancelProcessing(id: string): Promise<void> {
    await api.post(`/api/v1/pdfs/${id}/cancel`);
  },

  /**
   * Get download URL for a PDF
   */
  async getDownloadUrl(id: string): Promise<string> {
    const response = await api.get<{ success: boolean; data: { url: string } }>(
      `/api/v1/pdfs/${id}/download`
    );
    return response.data.data.url;
  },
};
