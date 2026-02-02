/**
 * Authentication middleware
 * Verifies JWT access tokens and attaches user info to request
 */
import { Request, Response, NextFunction } from 'express';

import { verifyAccessToken, type AccessTokenPayload } from '../config/jwt';
import { AuthenticationError, AuthorizationError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Extended Express Request with authenticated user
 */
export interface AuthenticatedRequest extends Request {
  user?: AccessTokenPayload;
}

/**
 * Extract bearer token from Authorization header
 * @param authHeader Authorization header value
 * @returns Token string or null
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] ?? null;
}

/**
 * Middleware to verify JWT access token
 * Attaches user payload to request if valid
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError('No authentication token provided');
    }

    const payload = verifyAccessToken(token);

    if (!payload) {
      throw new AuthenticationError('Invalid or expired token');
    }

    // Attach user info to request
    req.user = payload;

    logger.debug('Request authenticated', {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware to require specific user roles
 * Must be used after authenticate middleware
 * @param allowedRoles Array of allowed roles
 */
export function authorize(...allowedRoles: Array<'user' | 'admin'>) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError('Authentication required');
      }

      if (!allowedRoles.includes(req.user.role)) {
        logger.warn('Authorization failed - insufficient role', {
          userId: req.user.sub,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
        });
        throw new AuthorizationError('Insufficient permissions');
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Optional authentication middleware
 * Attaches user if token present, but doesn't require it
 */
export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractBearerToken(req.headers.authorization);

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      req.user = payload;
    }
  }

  next();
}
