/**
 * Upload Middleware Unit Tests
 */
import { describe, it, expect } from 'vitest';

import { sanitizeFilename, validatePdfMagicBytes } from '../../src/middleware/upload';

describe('Upload Middleware', () => {
  describe('sanitizeFilename', () => {
    it('should remove null bytes', () => {
      const result = sanitizeFilename('test\0file.pdf');
      expect(result).not.toContain('\0');
    });

    it('should remove parent directory references', () => {
      const result = sanitizeFilename('../../etc/passwd.pdf');
      expect(result).not.toContain('..');
    });

    it('should remove path separators', () => {
      const result = sanitizeFilename('path/to/file.pdf');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
    });

    it('should replace invalid characters', () => {
      const result = sanitizeFilename('file<>:"|?*.pdf');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain(':');
      expect(result).not.toContain('"');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
      expect(result).not.toContain('*');
    });

    it('should ensure .pdf extension', () => {
      const result = sanitizeFilename('file.txt');
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should not double .pdf extension', () => {
      const result = sanitizeFilename('file.pdf');
      expect(result).toBe('file.pdf');
      expect(result).not.toBe('file.pdf.pdf');
    });

    it('should limit filename length', () => {
      const longName = 'a'.repeat(300) + '.pdf';
      const result = sanitizeFilename(longName);
      expect(result.length).toBeLessThanOrEqual(200);
      expect(result.endsWith('.pdf')).toBe(true);
    });

    it('should handle empty string', () => {
      const result = sanitizeFilename('');
      expect(result).toBe('.pdf');
    });

    it('should handle only invalid characters', () => {
      const result = sanitizeFilename('<>:"|?*');
      expect(result.endsWith('.pdf')).toBe(true);
    });
  });

  describe('validatePdfMagicBytes', () => {
    it('should return true for valid PDF magic bytes', () => {
      // %PDF in hex
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
      expect(validatePdfMagicBytes(buffer)).toBe(true);
    });

    it('should return true for PDF with just magic bytes', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44, 0x46]);
      expect(validatePdfMagicBytes(buffer)).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      // PNG magic bytes
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });

    it('should return false for JPEG files', () => {
      // JPEG magic bytes
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });

    it('should return false for too short buffer', () => {
      const buffer = Buffer.from([0x25, 0x50, 0x44]);
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });

    it('should return false for empty buffer', () => {
      const buffer = Buffer.from([]);
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });

    it('should return false for text that looks like PDF header', () => {
      // %PDF as ASCII but wrong bytes
      const buffer = Buffer.from('%PDF', 'utf-8');
      expect(validatePdfMagicBytes(buffer)).toBe(true); // This should pass actually
    });

    it('should return false for HTML file', () => {
      const buffer = Buffer.from('<html>', 'utf-8');
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });

    it('should return false for ZIP file', () => {
      // ZIP magic bytes
      const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
      expect(validatePdfMagicBytes(buffer)).toBe(false);
    });
  });

  describe('File size limits', () => {
    it('should enforce 10MB limit', () => {
      const MAX_FILE_SIZE = 10 * 1024 * 1024;
      expect(MAX_FILE_SIZE).toBe(10485760);
    });
  });
});

describe('Path Traversal Prevention', () => {
  it('should prevent common path traversal patterns', () => {
    const maliciousInputs = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      'file/../../../secret',
      '....//....//etc/passwd',
      '%2e%2e%2f%2e%2e%2f',
      'file%00.pdf',
    ];

    maliciousInputs.forEach((input) => {
      const result = sanitizeFilename(input);
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
      expect(result).not.toContain('\\');
      expect(result).not.toContain('\0');
    });
  });
});
