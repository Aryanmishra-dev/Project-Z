/**
 * Progress Broadcaster
 * Utility for broadcasting PDF processing progress via WebSocket
 */
import { broadcastProgress, broadcastCompletion } from './socket-server';
import { JobProgress } from '../queues/pdf-queue';
import { logger } from '../utils/logger';

/**
 * Progress broadcaster class
 * Provides a clean interface for workers to broadcast progress
 */
class ProgressBroadcaster {
  /**
   * Broadcast progress update
   */
  broadcastProgress(userId: string, pdfId: string, progress: JobProgress): void {
    try {
      broadcastProgress(userId, pdfId, progress);
    } catch (error) {
      // Don't let broadcast failures affect processing
      logger.warn('Failed to broadcast progress', {
        userId,
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Broadcast successful completion
   */
  broadcastSuccess(userId: string, pdfId: string, questionCount: number): void {
    try {
      broadcastCompletion(userId, pdfId, {
        success: true,
        questionCount,
      });
    } catch (error) {
      logger.warn('Failed to broadcast completion', {
        userId,
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Broadcast failure
   */
  broadcastFailure(userId: string, pdfId: string, errorMessage: string): void {
    try {
      broadcastCompletion(userId, pdfId, {
        success: false,
        errorMessage,
      });
    } catch (error) {
      logger.warn('Failed to broadcast failure', {
        userId,
        pdfId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const progressBroadcaster = new ProgressBroadcaster();
