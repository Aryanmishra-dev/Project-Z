import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PDFCard } from '../PDFCard';
import * as pdfService from '@/services/pdf.service';

// Mock the PDF service
vi.mock('@/services/pdf.service', () => ({
  pdfService: {
    delete: vi.fn(),
  },
}));

const mockPdf = {
  id: '1',
  originalFilename: 'test-document.pdf',
  fileSize: 2048576, // ~2MB
  pageCount: 15,
  questionCount: 25,
  status: 'completed' as const,
  createdAt: new Date().toISOString(),
  processingProgress: 100,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('PDFCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders PDF filename', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });
    expect(screen.getByText('test-document.pdf')).toBeInTheDocument();
  });

  it('renders file size', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });
    expect(screen.getByText(/2.*mb/i)).toBeInTheDocument();
  });

  it('renders page count', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });
    expect(screen.getByText(/15.*page/i)).toBeInTheDocument();
  });

  it('renders question count for completed PDFs', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });
    expect(screen.getByText(/25.*question/i)).toBeInTheDocument();
  });

  it('renders status badge', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });
    expect(screen.getByText(/completed/i)).toBeInTheDocument();
  });

  it('shows processing indicator for processing status', () => {
    const processingPdf = { ...mockPdf, status: 'processing' as const, processingProgress: 50 };
    render(<PDFCard pdf={processingPdf} />, { wrapper: createWrapper() });

    expect(screen.getByText(/processing/i)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows pending status', () => {
    const pendingPdf = { ...mockPdf, status: 'pending' as const };
    render(<PDFCard pdf={pendingPdf} />, { wrapper: createWrapper() });

    expect(screen.getByText(/pending/i)).toBeInTheDocument();
  });

  it('shows failed status with error styling', () => {
    const failedPdf = { ...mockPdf, status: 'failed' as const };
    render(<PDFCard pdf={failedPdf} />, { wrapper: createWrapper() });

    expect(screen.getByText(/failed/i)).toBeInTheDocument();
  });

  it('has quiz button for completed PDFs', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    expect(screen.getByRole('button', { name: /quiz|start/i })).toBeInTheDocument();
  });

  it('disables quiz button for non-completed PDFs', () => {
    const processingPdf = { ...mockPdf, status: 'processing' as const };
    render(<PDFCard pdf={processingPdf} />, { wrapper: createWrapper() });

    const quizButton = screen.queryByRole('button', { name: /quiz|start/i });
    if (quizButton) {
      expect(quizButton).toBeDisabled();
    }
  });

  it('has delete button', async () => {
    const user = userEvent.setup();
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    expect(deleteButton).toBeInTheDocument();
  });

  it('shows delete confirmation dialog', async () => {
    const user = userEvent.setup();
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText(/are you sure|confirm/i)).toBeInTheDocument();
    });
  });

  it('calls delete service when confirmed', async () => {
    const user = userEvent.setup();
    vi.mocked(pdfService.pdfService.delete).mockResolvedValue(undefined);
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    // Find and click confirm button in dialog
    await waitFor(async () => {
      const confirmButton = screen.getByRole('button', { name: /confirm|delete/i });
      await user.click(confirmButton);
    });

    await waitFor(() => {
      expect(pdfService.pdfService.delete).toHaveBeenCalledWith('1');
    });
  });

  it('has link to PDF detail page', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/pdfs/1'));
  });

  it('displays relative time', () => {
    render(<PDFCard pdf={mockPdf} />, { wrapper: createWrapper() });

    // Should show relative time like "just now", "X minutes ago", etc.
    expect(screen.getByText(/ago|just now/i)).toBeInTheDocument();
  });
});
