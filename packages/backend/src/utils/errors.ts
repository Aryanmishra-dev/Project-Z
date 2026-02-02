/**
 * Custom error classes for the application
 * Provides structured error handling with proper HTTP status codes
 */

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational = true,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);

    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Validation error (400 Bad Request)
 * Used for invalid input data
 */
export class ValidationError extends AppError {
  public readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors: Record<string, string[]> = {}) {
    super(message, 400, 'VALIDATION_ERROR', true, { fieldErrors });
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Authentication error (401 Unauthorized)
 * Used when authentication fails or is missing
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Invalid credentials') {
    super(message, 401, 'AUTHENTICATION_ERROR', true);
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Authorization error (403 Forbidden)
 * Used when user lacks permission for an action
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR', true);
    Object.setPrototypeOf(this, AuthorizationError.prototype);
  }
}

/**
 * Not found error (404 Not Found)
 * Used when a requested resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

/**
 * Conflict error (409 Conflict)
 * Used when an action conflicts with existing data
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT', true);
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

/**
 * Rate limit error (429 Too Many Requests)
 * Used when rate limiting is triggered
 */
export class RateLimitError extends AppError {
  public readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `Too many requests, retry after ${retryAfter} seconds`,
      429,
      'RATE_LIMIT_EXCEEDED',
      true,
      { retryAfter }
    );
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Internal server error (500)
 * Used for unexpected server errors
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', false);
    Object.setPrototypeOf(this, InternalError.prototype);
  }
}

/**
 * Service unavailable error (503)
 * Used when a dependent service is unavailable
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`${service} is currently unavailable`, 503, 'SERVICE_UNAVAILABLE', true);
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype);
  }
}

/**
 * Check if an error is an operational error (expected, handled)
 * @param error Error to check
 * @returns True if error is operational
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
