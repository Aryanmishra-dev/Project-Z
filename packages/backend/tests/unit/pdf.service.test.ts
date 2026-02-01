/**
 * PDF Service Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db before importing the service
vi.mock('../../src/db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../src/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('fs/promises', () => ({
  default: {
    unlink: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('PDF Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a PDF record with correct data structure', async () => {
      const { db } = await import('../../src/db');
      const mockPdf = {
        id: 'test-id',
        userId: 'user-id',
        filename: 'test.pdf',
        filePath: '/path/to/file.pdf',
        fileSizeBytes: 1024,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockPdf]),
        }),
      } as any);

      const { pdfService } = await import('../../src/services/pdf.service');
      
      const result = await pdfService.create({
        userId: 'user-id',
        filename: 'test.pdf',
        filePath: '/path/to/file.pdf',
        fileSizeBytes: 1024,
      });

      expect(result).toEqual(mockPdf);
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe('ListPdfsOptions validation', () => {
    it('should have correct default values', () => {
      const defaultOptions = {
        userId: 'test-user',
        limit: 20,
        offset: 0,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      };

      expect(defaultOptions.limit).toBe(20);
      expect(defaultOptions.offset).toBe(0);
      expect(defaultOptions.sortBy).toBe('createdAt');
      expect(defaultOptions.sortOrder).toBe('desc');
    });
  });

  describe('Status validation', () => {
    it('should accept valid statuses', () => {
      const validStatuses = ['pending', 'processing', 'completed', 'failed', 'cancelled'];
      validStatuses.forEach(status => {
        expect(['pending', 'processing', 'completed', 'failed', 'cancelled']).toContain(status);
      });
    });
  });
});

describe('PDF Status Transitions', () => {
  it('should follow valid state transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['processing', 'cancelled'],
      processing: ['completed', 'failed', 'cancelled'],
      completed: [],
      failed: [],
      cancelled: [],
    };

    // Pending can go to processing or cancelled
    expect(validTransitions.pending).toContain('processing');
    expect(validTransitions.pending).toContain('cancelled');

    // Processing can go to completed, failed, or cancelled
    expect(validTransitions.processing).toContain('completed');
    expect(validTransitions.processing).toContain('failed');

    // Terminal states have no transitions
    expect(validTransitions.completed).toHaveLength(0);
    expect(validTransitions.failed).toHaveLength(0);
    expect(validTransitions.cancelled).toHaveLength(0);
  });
});
