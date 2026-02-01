/**
 * Global error handler middleware
 * Catches all errors and formats consistent API responses
 */
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { 
  AppError, 
  ValidationError, 
} from '../utils/errors';
import { logger, getRequestId } from '../utils/logger';

/**
 * Standard API error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string | null;
  };
}

/**
 * Format Zod validation error
 */
function formatZodError(error: ZodError): ValidationError {
  const fieldErrors: Record<string, string[]> = {};
  
  for (const issue of error.errors) {
    const path = issue.path.join('.') || '_root';
    if (!fieldErrors[path]) {
      fieldErrors[path] = [];
    }
    fieldErrors[path].push(issue.message);
  }
  
  return new ValidationError('Validation failed', fieldErrors);
}

/**
 * Global error handler middleware
 * Must be registered last in the middleware chain
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getRequestId();

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    err = formatZodError(err);
  }

  // Handle operational errors (expected errors)
  if (err instanceof AppError) {
    // Log based on severity
    if (err.statusCode >= 500) {
      logger.error('Server error', {
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        stack: err.stack,
        path: req.path,
        method: req.method,
        request_id: requestId,
      });
    } else if (err.statusCode >= 400) {
      logger.warn('Client error', {
        error: err.message,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        request_id: requestId,
      });
    }

    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        requestId,
      },
    };

    // Add field errors for validation errors
    if (err instanceof ValidationError) {
      response.error.details = { fieldErrors: err.fieldErrors };
    } else if (err.details) {
      response.error.details = err.details;
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unexpected errors
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    request_id: requestId,
  });

  // Don't expose internal error details in production
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      requestId,
    },
  };

  res.status(500).json(response);
}

/**
 * 404 Not Found handler
 * Use this for unmatched routes
 */
export function notFoundHandler(
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = getRequestId();
  
  logger.debug('Route not found', {
    path: req.path,
    method: req.method,
    request_id: requestId,
  });

  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      requestId,
    },
  };

  res.status(404).json(response);
}

/**
 * Async handler wrapper
 * Wraps async route handlers to properly catch and forward errors
 */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: T, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
