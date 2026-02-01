/**
 * PDF Processing Worker
 * Handles async PDF processing jobs with NLP service integration
 */
import { Worker, Job } from 'bullmq';
import fs from 'fs';
import {
  QUEUE_NAMES,
  PdfProcessingJobData,
  PdfProcessingJobResult,
  JobProgress,
} from '../queues/pdf-queue';
import { pdfService } from '../services/pdf.service';
import { questionsService } from '../services/questions.service';
import { progressBroadcaster } from '../websocket/progress-broadcaster';
import { logger } from '../utils/logger';
import { PdfMetadata } from '../db/schema/pdfs';
import { NewQuestion } from '../db/schema/questions';

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
  page_count: number;
  text_length: number;
  metadata: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string[];
  };
  extracted_text: string;
}

/**
 * NLP question generation response
 */
interface NlpQuestionResponse {
  success: boolean;
  questions: Array<{
    question_text: string;
    options: {
      A: string;
      B: string;
      C: string;
      D: string;
    };
    correct_option: string;
    explanation: string;
    difficulty: 'easy' | 'medium' | 'hard';
    page_reference?: number;
    quality_score: number;
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

    const response = await fetch(`${NLP_SERVICE_URL}/api/v1/extract`, {
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
    const response = await fetch(`${NLP_SERVICE_URL}/api/v1/generate-questions`, {
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

    // Stage 3: Generate questions
    await updateProgress(job, {
      stage: 'generating',
      percentage: 40,
      message: 'Generating quiz questions...',
      currentStep: 3,
      totalSteps: 5,
    });

    const questionResult = await generateQuestions(extraction.extracted_text);

    if (!questionResult.success || !questionResult.questions.length) {
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

    // Convert to database format
    const questionsToSave: NewQuestion[] = questionResult.questions.map((q) => ({
      pdfId,
      questionText: q.question_text,
      options: q.options,
      correctOption: q.correct_option,
      explanation: q.explanation,
      difficulty: q.difficulty,
      pageReference: q.page_reference,
      qualityScore: q.quality_score.toString(),
      validationStatus: 'pending' as const,
    }));

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
      title: extraction.metadata.title,
      author: extraction.metadata.author,
      subject: extraction.metadata.subject,
      keywords: extraction.metadata.keywords,
      extractedTextLength: extraction.text_length,
    };

    await pdfService.updateStatus(pdfId, 'completed', {
      pageCount: extraction.page_count,
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
