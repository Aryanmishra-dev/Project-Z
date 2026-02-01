/**
 * BullMQ Queue Configuration
 * Job queue setup for PDF processing
 */
import { Queue, Job, QueueEvents } from 'bullmq';
import { logger } from '../utils/logger';

/**
 * Queue names
 */
export const QUEUE_NAMES = {
  PDF_PROCESSING: 'pdf-processing',
} as const;

/**
 * PDF processing job data
 */
export interface PdfProcessingJobData {
  pdfId: string;
  userId: string;
  filePath: string;
  filename: string;
}

/**
 * PDF processing job result
 */
export interface PdfProcessingJobResult {
  success: boolean;
  pdfId: string;
  questionCount?: number;
  pageCount?: number;
  errorMessage?: string;
}

/**
 * Job progress data
 */
export interface JobProgress {
  stage: 'uploading' | 'extracting' | 'generating' | 'validating' | 'saving' | 'completed' | 'failed';
  percentage: number;
  message: string;
  currentStep?: number;
  totalSteps?: number;
}

/**
 * Default job options
 */
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // Start with 5 seconds
  },
  removeOnComplete: {
    count: 100, // Keep last 100 completed jobs
    age: 24 * 60 * 60, // Keep for 24 hours
  },
  removeOnFail: {
    count: 50, // Keep last 50 failed jobs
    age: 7 * 24 * 60 * 60, // Keep for 7 days
  },
};

/**
 * Redis connection configuration for BullMQ
 */
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_QUEUE_DB || '1', 10), // Use separate DB for queues
};

/**
 * PDF Processing Queue
 */
export const pdfProcessingQueue = new Queue<PdfProcessingJobData, PdfProcessingJobResult>(
  QUEUE_NAMES.PDF_PROCESSING,
  {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

/**
 * Queue events for monitoring
 */
export const pdfProcessingQueueEvents = new QueueEvents(QUEUE_NAMES.PDF_PROCESSING, {
  connection,
});

// Event listeners for logging
pdfProcessingQueueEvents.on('completed', ({ jobId, returnvalue }: { jobId: string; returnvalue: any }) => {
  logger.info('PDF processing job completed', { jobId, result: returnvalue });
});

pdfProcessingQueueEvents.on('failed', ({ jobId, failedReason }: { jobId: string; failedReason: string }) => {
  logger.error('PDF processing job failed', { jobId, reason: failedReason });
});

pdfProcessingQueueEvents.on('progress', ({ jobId, data }: { jobId: string; data: any }) => {
  logger.debug('PDF processing job progress', { jobId, progress: data });
});

pdfProcessingQueueEvents.on('stalled', ({ jobId }: { jobId: string }) => {
  logger.warn('PDF processing job stalled', { jobId });
});

/**
 * Add a PDF processing job to the queue
 */
export async function addPdfProcessingJob(data: PdfProcessingJobData): Promise<Job<PdfProcessingJobData, PdfProcessingJobResult>> {
  const job = await pdfProcessingQueue.add(`process-pdf-${data.pdfId}`, data, {
    jobId: `pdf-${data.pdfId}`, // Use PDF ID as job ID for deduplication
  });
  
  logger.info('PDF processing job added', { jobId: job.id, pdfId: data.pdfId });
  return job;
}

/**
 * Get job by PDF ID
 */
export async function getJobByPdfId(pdfId: string): Promise<Job<PdfProcessingJobData, PdfProcessingJobResult> | undefined> {
  return pdfProcessingQueue.getJob(`pdf-${pdfId}`);
}

/**
 * Get job status
 */
export async function getJobStatus(pdfId: string): Promise<{
  status: string;
  progress?: JobProgress;
  result?: PdfProcessingJobResult;
  failedReason?: string;
  attemptsMade?: number;
} | null> {
  const job = await getJobByPdfId(pdfId);
  if (!job) return null;

  const state = await job.getState();
  const progress = job.progress as JobProgress | undefined;

  return {
    status: state,
    progress,
    result: job.returnvalue,
    failedReason: job.failedReason,
    attemptsMade: job.attemptsMade,
  };
}

/**
 * Cancel a pending job
 */
export async function cancelJob(pdfId: string): Promise<boolean> {
  const job = await getJobByPdfId(pdfId);
  if (!job) return false;

  const state = await job.getState();
  if (state === 'waiting' || state === 'delayed') {
    await job.remove();
    logger.info('PDF processing job cancelled', { jobId: job.id, pdfId });
    return true;
  }

  return false;
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    pdfProcessingQueue.getWaitingCount(),
    pdfProcessingQueue.getActiveCount(),
    pdfProcessingQueue.getCompletedCount(),
    pdfProcessingQueue.getFailedCount(),
    pdfProcessingQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Clean up old jobs
 */
export async function cleanupJobs(): Promise<void> {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  
  await Promise.all([
    pdfProcessingQueue.clean(oneWeekAgo, 1000, 'completed'),
    pdfProcessingQueue.clean(oneWeekAgo, 1000, 'failed'),
  ]);
  
  logger.info('Queue cleanup completed');
}

/**
 * Close queue connections gracefully
 */
export async function closeQueues(): Promise<void> {
  await Promise.all([
    pdfProcessingQueue.close(),
    pdfProcessingQueueEvents.close(),
  ]);
  
  logger.info('Queue connections closed');
}
