/**
 * Request ID middleware
 * Generates and tracks request IDs for logging and tracing
 */
import crypto from 'crypto';

import { Request, Response, NextFunction } from 'express';

import { setRequestId, clearRequestId } from '../utils/logger';

/**
 * Request ID header name
 */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Middleware to generate or forward request IDs
 * Also sets up cleanup on response finish
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Use existing request ID from header or generate new one
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || crypto.randomUUID();

  // Store in request for access throughout lifecycle
  (req as any).requestId = requestId;

  // Set in response header
  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Set in logger context
  setRequestId(requestId);

  // Clean up on response finish
  res.on('finish', () => {
    clearRequestId();
  });

  next();
}

/**
 * Get request ID from request object
 */
export function getRequestIdFromRequest(req: Request): string | undefined {
  return (req as any).requestId;
}
