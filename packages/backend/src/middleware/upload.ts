/**
 * File upload middleware using Multer
 * Handles PDF uploads with security validations
 */
import multer, { FileFilterCallback } from 'multer';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from './auth';
import { ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * PDF magic bytes (file signature)
 */
const PDF_MAGIC_BYTES = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

/**
 * Maximum file size: 10MB
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Upload directory base path
 */
const UPLOAD_BASE_DIR = process.env.UPLOAD_DIR || './uploads/pdfs';

/**
 * Ensure upload directory exists for a user
 */
function ensureUploadDir(userId: string): string {
  const userDir = path.join(UPLOAD_BASE_DIR, userId);
  
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true, mode: 0o755 });
  }
  
  return userDir;
}

/**
 * Sanitize filename to prevent path traversal attacks
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename
    .replace(/\0/g, '') // Remove null bytes
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/[<>:"|?*]/g, '_'); // Replace invalid chars with underscore
  
  // Ensure it ends with .pdf
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    sanitized += '.pdf';
  }
  
  // Limit length
  if (sanitized.length > 200) {
    const ext = '.pdf';
    sanitized = sanitized.substring(0, 200 - ext.length) + ext;
  }
  
  return sanitized;
}

/**
 * Validate PDF magic bytes
 */
export function validatePdfMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return buffer.subarray(0, 4).equals(PDF_MAGIC_BYTES);
}

/**
 * Multer storage configuration
 */
const storage = multer.diskStorage({
  destination: (req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    try {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user?.sub) {
        return cb(new Error('User not authenticated'), '');
      }
      
      const uploadDir = ensureUploadDir(authReq.user.sub);
      cb(null, uploadDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  
  filename: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    // Generate UUID filename to prevent conflicts and path traversal
    const uuid = uuidv4();
    const ext = '.pdf';
    const filename = `${uuid}${ext}`;
    
    cb(null, filename);
  },
});

/**
 * File filter to only accept PDFs
 */
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
): void => {
  // Check MIME type
  if (file.mimetype !== 'application/pdf') {
    logger.warn('Upload rejected: Invalid MIME type', {
      mimetype: file.mimetype,
      filename: file.originalname,
    });
    return cb(new ValidationError('Only PDF files are allowed', {
      file: ['File must be a PDF (application/pdf)'],
    }));
  }
  
  // Check extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.pdf') {
    logger.warn('Upload rejected: Invalid extension', {
      extension: ext,
      filename: file.originalname,
    });
    return cb(new ValidationError('Only PDF files are allowed', {
      file: ['File must have .pdf extension'],
    }));
  }
  
  cb(null, true);
};

/**
 * Configured multer instance for PDF uploads
 */
export const pdfUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Only allow single file upload
  },
});

/**
 * Middleware to validate PDF magic bytes after upload
 * Must be used after multer middleware
 */
export async function validatePdfContent(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.file) {
      throw new ValidationError('No file uploaded', {
        file: ['File is required'],
      });
    }

    // Read first 4 bytes of file
    const fd = fs.openSync(req.file.path, 'r');
    const buffer = Buffer.alloc(4);
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    // Validate magic bytes
    if (!validatePdfMagicBytes(buffer)) {
      // Delete the invalid file
      fs.unlinkSync(req.file.path);
      
      logger.warn('Upload rejected: Invalid PDF magic bytes', {
        filename: req.file.originalname,
      });
      
      throw new ValidationError('Invalid PDF file', {
        file: ['File does not appear to be a valid PDF'],
      });
    }

    // Set file permissions (rw-r--r--)
    fs.chmodSync(req.file.path, 0o644);

    logger.debug('PDF content validated', {
      filename: req.file.originalname,
      size: req.file.size,
    });

    next();
  } catch (error) {
    next(error);
  }
}
