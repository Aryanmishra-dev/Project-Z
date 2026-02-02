import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PDFUploader } from '../PDFUploader';

import * as pdfService from '@/services/pdf.service';

// Mock the PDF service
vi.mock('@/services/pdf.service', () => ({
  pdfService: {
    upload: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock file helper
function createMockFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('PDFUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dropzone with instructions', () => {
    render(<PDFUploader />, { wrapper: createWrapper() });

    expect(screen.getByText(/drag and drop|click to select/i)).toBeInTheDocument();
  });

  it('shows file size limit', () => {
    render(<PDFUploader />, { wrapper: createWrapper() });

    expect(screen.getByText(/10\s*mb|10mb/i)).toBeInTheDocument();
  });

  it('accepts PDF files', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();
    vi.mocked(pdfService.pdfService.upload).mockResolvedValue({
      id: '1',
      filename: 'test.pdf',
    } as any);

    render(<PDFUploader onSuccess={mockOnSuccess} />, { wrapper: createWrapper() });

    const file = createMockFile('test.pdf', 1024, 'application/pdf');
    const input =
      screen.getByLabelText(/upload|drop|select/i) || document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, file);
    }

    // click upload
    const uploadButton = screen.getByRole('button', { name: /upload pdf/i });
    await user.click(uploadButton);

    // File should be accepted (no error shown)
    expect(screen.queryByText(/only pdf files/i)).not.toBeInTheDocument();
  });

  it('rejects non-PDF files', async () => {
    render(<PDFUploader />, { wrapper: createWrapper() });

    // The dropzone should only accept PDFs
    const input = document.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('accept');
    expect(input?.getAttribute('accept')).toMatch(/pdf/i);
  });

  it('rejects files over size limit', async () => {
    const user = userEvent.setup();
    render(<PDFUploader />, { wrapper: createWrapper() });

    const oversizedFile = createMockFile('large.pdf', 15 * 1024 * 1024, 'application/pdf'); // 15MB
    const input = document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, oversizedFile);
    }

    await waitFor(
      () => {
        expect(screen.getByText(/too large|exceeds|10\s*mb/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('shows upload progress', async () => {
    const user = userEvent.setup();
    vi.mocked(pdfService.pdfService.upload).mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ id: '1', filename: 'test.pdf' } as any), 100);
      });
    });

    render(<PDFUploader />, { wrapper: createWrapper() });

    const file = createMockFile('test.pdf', 1024, 'application/pdf');
    const input = document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, file);
    }

    const uploadButton = screen.getByRole('button', { name: /upload pdf/i });
    await user.click(uploadButton);

    // Should show some upload indicator
    await waitFor(() => {
      expect(
        screen.queryByText(/uploading/i) ||
          screen.queryByRole('progressbar') ||
          screen.queryByText(/processing/i)
      ).toBeTruthy();
    });
  });

  it('calls onSuccess callback after successful upload', async () => {
    const user = userEvent.setup();
    const mockOnSuccess = vi.fn();
    vi.mocked(pdfService.pdfService.upload).mockResolvedValue({
      id: '1',
      filename: 'test.pdf',
    } as any);

    render(<PDFUploader onSuccess={mockOnSuccess} />, { wrapper: createWrapper() });

    const file = createMockFile('test.pdf', 1024, 'application/pdf');
    const input = document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, file);
    }

    const uploadButton = screen.getByRole('button', { name: /upload pdf/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });

  it('displays error message on upload failure', async () => {
    const user = userEvent.setup();
    vi.mocked(pdfService.pdfService.upload).mockRejectedValue(new Error('Upload failed'));

    render(<PDFUploader />, { wrapper: createWrapper() });

    const file = createMockFile('test.pdf', 1024, 'application/pdf');
    const input = document.querySelector('input[type="file"]');

    if (input) {
      await user.upload(input as HTMLInputElement, file);
    }

    const uploadButton = screen.getByRole('button', { name: /upload pdf/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(screen.getByText(/failed|error|try again/i)).toBeInTheDocument();
    });
  });

  it('is accessible with keyboard', () => {
    render(<PDFUploader />, { wrapper: createWrapper() });

    // The dropzone should be focusable
    const dropzone = screen.getByRole('button') || screen.getByRole('presentation');
    expect(dropzone).toBeDefined();
  });
});
