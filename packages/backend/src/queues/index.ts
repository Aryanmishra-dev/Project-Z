/**
 * Queue module index
 * Exports queue configurations and utilities
 */

export {
  QUEUE_NAMES,
  pdfProcessingQueue,
  pdfProcessingQueueEvents,
  addPdfProcessingJob,
  getJobByPdfId,
  getJobStatus,
  cancelJob,
  getQueueStats,
  cleanupJobs,
  closeQueues,
  type PdfProcessingJobData,
  type PdfProcessingJobResult,
  type JobProgress,
} from './pdf-queue';
