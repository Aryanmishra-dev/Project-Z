/**
 * Middleware module index
 * Exports all middleware functions
 */

export { authenticate, authorize, optionalAuth, type AuthenticatedRequest } from './auth';

export {
  validate,
  validateMultiple,
  type ValidationTarget,
  type ValidationOptions,
} from './validate';

export { authRateLimiter, apiRateLimiter, loginRateLimiter, strictRateLimiter } from './rate-limit';

export { errorHandler, notFoundHandler, asyncHandler, type ErrorResponse } from './error-handler';

export { requestIdMiddleware, getRequestIdFromRequest, REQUEST_ID_HEADER } from './request-id';

export { checkOwnership, checkPdfOwnership, checkQuizSessionOwnership } from './check-ownership';

export { pdfUpload, validatePdfContent, sanitizeFilename, validatePdfMagicBytes } from './upload';
