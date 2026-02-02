/**
 * PDF Processing Worker
 * Handles async PDF processing jobs with NLP service integration
 */
import fs from 'fs';

import { Worker, Job } from 'bullmq';

import { PdfMetadata } from '../db/schema/pdfs';
import { NewQuestion } from '../db/schema/questions';
import {
  QUEUE_NAMES,
  PdfProcessingJobData,
  PdfProcessingJobResult,
  JobProgress,
} from '../queues/pdf-queue';
import { pdfService } from '../services/pdf.service';
import { questionsService } from '../services/questions.service';
import { logger } from '../utils/logger';
import { progressBroadcaster } from '../websocket/progress-broadcaster';

/**
 * NLP Service configuration
 */
const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';
const NLP_SERVICE_TIMEOUT = parseInt(process.env.NLP_SERVICE_TIMEOUT || '300000', 10); // 5 minutes

/**
 * NLP extraction response
 */
interface NlpExtractionResponse {
  success: boolean;
  page_count?: number;
  pageCount?: number;
  text_length?: number;
  wordCount?: number;
  text?: string;
  extracted_text?: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
    pageCount?: number;
    wordCount?: number;
  };
}

/**
 * NLP question option (app module format)
 */
interface NlpQuestionOption {
  id: string;
  text: string;
}

/**
 * NLP question generation response
 */
interface NlpQuestionResponse {
  success?: boolean;
  questions: Array<{
    // snake_case format (root main.py)
    question_text?: string;
    options?: { A: string; B: string; C: string; D: string } | NlpQuestionOption[];
    correct_option?: string;
    quality_score?: number;
    page_reference?: number;
    // camelCase format (app module)
    questionText?: string;
    correctAnswer?: string;
    qualityScore?: number;
    validationPassed?: boolean;
    // common fields
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
}

/**
 * Update job progress and broadcast via WebSocket
 */
async function updateProgress(
  job: Job<PdfProcessingJobData, PdfProcessingJobResult>,
  progress: JobProgress
): Promise<void> {
  await job.updateProgress(progress);

  // Broadcast to connected clients
  progressBroadcaster.broadcastProgress(job.data.userId, job.data.pdfId, progress);
}

/**
 * Extract text from PDF using NLP service
 */
async function extractPdfText(filePath: string): Promise<NlpExtractionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NLP_SERVICE_TIMEOUT);

  try {
    // Read file as buffer and create native FormData
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = filePath.split('/').pop() || 'document.pdf';

    // Create a Blob from the buffer
    const blob = new Blob([fileBuffer], { type: 'application/pdf' });

    // Use native FormData (available in Node 18+)
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const response = await fetch(`${NLP_SERVICE_URL}/api/v1/pdf/extract`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`NLP extraction failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<NlpExtractionResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generate questions from extracted text
 */
async function generateQuestions(
  text: string,
  options?: {
    count?: number;
    difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  }
): Promise<NlpQuestionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NLP_SERVICE_TIMEOUT);

  try {
    const response = await fetch(`${NLP_SERVICE_URL}/api/v1/questions/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        count: options?.count || 10,
        difficulty: options?.difficulty || 'mixed',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Question generation failed: ${response.status} - ${error}`);
    }

    return response.json() as Promise<NlpQuestionResponse>;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Process a PDF job
 */
async function processPdfJob(
  job: Job<PdfProcessingJobData, PdfProcessingJobResult>
): Promise<PdfProcessingJobResult> {
  const { pdfId, userId, filePath, filename } = job.data;

  logger.info('Starting PDF processing', { jobId: job.id, pdfId, filename });

  try {
    // Stage 1: Update status to processing
    await updateProgress(job, {
      stage: 'extracting',
      percentage: 10,
      message: 'Starting PDF extraction...',
      currentStep: 1,
      totalSteps: 5,
    });

    await pdfService.updateStatus(pdfId, 'processing');

    // Stage 2: Extract text from PDF
    await updateProgress(job, {
      stage: 'extracting',
      percentage: 20,
      message: 'Extracting text from PDF...',
      currentStep: 2,
      totalSteps: 5,
    });

    const extraction = await extractPdfText(filePath);

    if (!extraction.success) {
      throw new Error('PDF extraction returned unsuccessful response');
    }

    // Get extracted text from either format
    const extractedText = extraction.extracted_text || extraction.text || '';
    const pageCount =
      extraction.page_count || extraction.pageCount || extraction.metadata?.pageCount || 0;
    const textLength =
      extraction.text_length ||
      extraction.wordCount ||
      extraction.metadata?.wordCount ||
      extractedText.length;

    if (!extractedText || extractedText.length < 100) {
      throw new Error('Insufficient text extracted from PDF');
    }

    // Stage 3: Generate questions
    await updateProgress(job, {
      stage: 'generating',
      percentage: 40,
      message: 'Generating quiz questions...',
      currentStep: 3,
      totalSteps: 5,
    });

    const questionResult = await generateQuestions(extractedText);

    if (!questionResult.questions || !questionResult.questions.length) {
      throw new Error('No questions could be generated from the PDF');
    }

    // Stage 4: Validate and save questions
    await updateProgress(job, {
      stage: 'validating',
      percentage: 60,
      message: `Validating ${questionResult.questions.length} questions...`,
      currentStep: 4,
      totalSteps: 5,
    });

    // Convert to database format - handle both snake_case and camelCase response formats
    const questionsToSave: NewQuestion[] = questionResult.questions.map((q) => {
      // Handle options format - can be object {A, B, C, D} or array [{id, text}]
      let optionsObj: { A: string; B: string; C: string; D: string };
      if (Array.isArray(q.options)) {
        // App module format: [{id: "A", text: "..."}, ...]
        optionsObj = { A: '', B: '', C: '', D: '' };
        for (const opt of q.options) {
          if (opt.id && opt.text) {
            optionsObj[opt.id as keyof typeof optionsObj] = opt.text;
          }
        }
      } else if (q.options) {
        // Root main.py format: {A: "...", B: "...", ...}
        optionsObj = q.options as { A: string; B: string; C: string; D: string };
      } else {
        optionsObj = { A: '', B: '', C: '', D: '' };
      }

      return {
        pdfId,
        questionText: q.question_text || q.questionText || '',
        options: optionsObj,
        correctOption: q.correct_option || q.correctAnswer || 'A',
        explanation: q.explanation || '',
        difficulty: q.difficulty,
        pageReference: q.page_reference,
        qualityScore: String(q.quality_score ?? q.qualityScore ?? 0.5),
        validationStatus: 'pending' as const,
      };
    });

    // Stage 5: Save questions to database
    await updateProgress(job, {
      stage: 'saving',
      percentage: 80,
      message: 'Saving questions to database...',
      currentStep: 5,
      totalSteps: 5,
    });

    await questionsService.createBatch(questionsToSave);

    // Update PDF with metadata and status
    const metadata: PdfMetadata = {
      title: extraction.metadata?.title,
      author: extraction.metadata?.author,
      subject: extraction.metadata?.subject,
      keywords: extraction.metadata?.keywords,
      extractedTextLength: textLength,
    };

    await pdfService.updateStatus(pdfId, 'completed', {
      pageCount: pageCount,
      metadata,
    });

    // Final progress update
    await updateProgress(job, {
      stage: 'completed',
      percentage: 100,
      message: `Successfully generated ${questionResult.questions.length} questions`,
      currentStep: 5,
      totalSteps: 5,
    });

    logger.info('PDF processing completed', {
      jobId: job.id,
      pdfId,
      questionCount: questionResult.questions.length,
      pageCount: extraction.page_count,
    });

    return {
      success: true,
      pdfId,
      questionCount: questionResult.questions.length,
      pageCount: extraction.page_count,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    logger.error('PDF processing failed', {
      jobId: job.id,
      pdfId,
      error: errorMessage,
      attempt: job.attemptsMade,
    });

    // Update progress to failed
    await updateProgress(job, {
      stage: 'failed',
      percentage: 0,
      message: errorMessage,
    });

    // Only mark as failed on final attempt
    if (job.attemptsMade >= (job.opts.attempts || 3)) {
      await pdfService.updateStatus(pdfId, 'failed', { errorMessage });
    }

    throw error;
  }
}

/**
 * Redis connection configuration for worker
 */
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_QUEUE_DB || '1', 10),
};

/**
 * PDF Processing Worker instance
 */
export const pdfProcessingWorker = new Worker<PdfProcessingJobData, PdfProcessingJobResult>(
  QUEUE_NAMES.PDF_PROCESSING,
  processPdfJob,
  {
    connection,
    concurrency: parseInt(process.env.PDF_WORKER_CONCURRENCY || '2', 10),
    limiter: {
      max: 5,
      duration: 60000, // Max 5 jobs per minute
    },
  }
);

// Worker event handlers
pdfProcessingWorker.on('completed', (job, result) => {
  logger.info('Worker completed job', { jobId: job.id, result });
});

pdfProcessingWorker.on('failed', (job, error) => {
  logger.error('Worker job failed', {
    jobId: job?.id,
    error: error.message,
    attemptsMade: job?.attemptsMade,
  });
});

pdfProcessingWorker.on('error', (error) => {
  logger.error('Worker error', { error: error.message });
});

pdfProcessingWorker.on('stalled', (jobId) => {
  logger.warn('Worker job stalled', { jobId });
});

/**
 * Close worker gracefully
 */
export async function closeWorker(): Promise<void> {
  await pdfProcessingWorker.close();
  logger.info('PDF processing worker closed');
}

/**
 * Check if worker is running
 */
export function isWorkerRunning(): boolean {
  return pdfProcessingWorker.isRunning();
}
