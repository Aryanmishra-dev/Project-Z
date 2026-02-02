/**
 * Ownership check middleware
 * Verifies resources belong to the authenticated user
 */
import { eq, and, isNull } from 'drizzle-orm';
import { Response, NextFunction } from 'express';

import { AuthenticatedRequest } from './auth';
import { db } from '../db';
import { pdfs } from '../db/schema/pdfs';
import { quizSessions } from '../db/schema/quiz-sessions';
import { AuthorizationError, NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Resource types that can be checked for ownership
 */
export type ResourceType = 'pdf' | 'quiz-session';

/**
 * Middleware factory to check resource ownership
 * @param resourceType Type of resource to check
 * @param paramName Request parameter containing resource ID
 */
export function checkOwnership(resourceType: ResourceType, paramName = 'id') {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AuthorizationError('Authentication required');
      }

      const resourceId = req.params[paramName];
      if (!resourceId) {
        throw new NotFoundError(resourceType);
      }

      const userId = req.user.sub;
      let isOwner = false;

      switch (resourceType) {
        case 'pdf': {
          const [pdf] = await db
            .select({ userId: pdfs.userId })
            .from(pdfs)
            .where(and(eq(pdfs.id, resourceId), isNull(pdfs.deletedAt)))
            .limit(1);

          if (!pdf) {
            throw new NotFoundError('PDF');
          }
          isOwner = pdf.userId === userId;
          break;
        }

        case 'quiz-session': {
          const [session] = await db
            .select({ userId: quizSessions.userId })
            .from(quizSessions)
            .where(eq(quizSessions.id, resourceId))
            .limit(1);

          if (!session) {
            throw new NotFoundError('Quiz session');
          }
          isOwner = session.userId === userId;
          break;
        }

        default:
          throw new Error(`Unknown resource type: ${resourceType}`);
      }

      if (!isOwner) {
        logger.warn('Ownership check failed', {
          resourceType,
          resourceId,
          userId,
        });
        throw new AuthorizationError('You do not have permission to access this resource');
      }

      logger.debug('Ownership check passed', {
        resourceType,
        resourceId,
        userId,
      });

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Combined ownership check for PDF-related operations
 */
export const checkPdfOwnership = checkOwnership('pdf', 'id');

/**
 * Combined ownership check for quiz session operations
 */
export const checkQuizSessionOwnership = checkOwnership('quiz-session', 'id');
