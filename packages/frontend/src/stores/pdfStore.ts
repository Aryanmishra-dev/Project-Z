import { create } from 'zustand';

import type { PDFStatus, ProcessingStep, UploadProgress } from '@/types';

interface PDFFilters {
  status: PDFStatus | 'all';
  sortBy: 'createdAt' | 'originalFilename';
  sortOrder: 'asc' | 'desc';
}

interface PDFState {
  filters: PDFFilters;
  uploadProgress: Record<string, UploadProgress>;
  currentPage: number;
}

interface PDFActions {
  setFilters: (filters: Partial<PDFFilters>) => void;
  resetFilters: () => void;
  setCurrentPage: (page: number) => void;
  updateProgress: (pdfId: string, progress: number, step: ProcessingStep, message: string) => void;
  clearProgress: (pdfId: string) => void;
}

export type PDFStore = PDFState & PDFActions;

const defaultFilters: PDFFilters = {
  status: 'all',
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const usePDFStore = create<PDFStore>((set) => ({
  filters: defaultFilters,
  uploadProgress: {},
  currentPage: 1,

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      currentPage: 1, // Reset to first page when filters change
    })),

  resetFilters: () =>
    set({
      filters: defaultFilters,
      currentPage: 1,
    }),

  setCurrentPage: (page) => set({ currentPage: page }),

  updateProgress: (pdfId, progress, step, message) =>
    set((state) => ({
      uploadProgress: {
        ...state.uploadProgress,
        [pdfId]: { pdfId, progress, step, message },
      },
    })),

  clearProgress: (pdfId) =>
    set((state) => {
      const { [pdfId]: _, ...rest } = state.uploadProgress;
      return { uploadProgress: rest };
    }),
}));
