import path from 'path';

import { Router } from 'express';
import multer from 'multer';

export const quizRouter = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: process.env.UPLOAD_DIR || './uploads/pdfs',
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || '10') * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

/**
 * Upload PDF and generate quiz
 */
quizRouter.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      });
    }

    res.json({
      success: true,
      message: 'PDF uploaded successfully',
      data: {
        filename: req.file.filename,
        size: req.file.size,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Upload failed',
    });
  }
});

/**
 * Get all quizzes
 */
quizRouter.get('/', async (_req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Quiz list endpoint - to be implemented',
  });
});

/**
 * Get quiz by ID
 */
quizRouter.get('/:id', async (req, res) => {
  res.json({
    success: true,
    data: { id: req.params.id },
    message: 'Quiz detail endpoint - to be implemented',
  });
});
