/**
 * Authentication controller
 * Handles HTTP request/response for auth operations
 */
import { Response, NextFunction } from 'express';

import { AuthenticatedRequest, asyncHandler } from '../middleware';
import {
  register as registerService,
  login as loginService,
  refresh as refreshService,
  logout as logoutService,
  logoutAll as logoutAllService,
  getProfile as getProfileService,
} from '../services/auth.service';
import { logger } from '../utils/logger';

/**
 * Standard API response structure
 */
interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

/**
 * Extract device info from request
 */
function getDeviceInfo(req: AuthenticatedRequest): { userAgent: string; ipAddress: string } {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ip = forwardedFor
    ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0])?.trim()
    : req.ip || req.socket.remoteAddress;

  return {
    userAgent: req.headers['user-agent'] || 'unknown',
    ipAddress: ip || 'unknown',
  };
}

/**
 * Register new user
 * POST /api/v1/auth/register
 */
export const register = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password, fullName } = req.body;
    const meta = getDeviceInfo(req);

    logger.info('Registration attempt', { email });

    const result = await registerService({ email, password, fullName }, meta);

    const response: ApiResponse = {
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      },
      message: 'Registration successful',
    };

    res.status(201).json(response);
  }
);

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const { email, password } = req.body;
    const meta = getDeviceInfo(req);

    logger.info('Login attempt', { email });

    const result = await loginService({ email, password }, meta);

    const response: ApiResponse = {
      success: true,
      data: {
        user: result.user,
        tokens: {
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      },
      message: 'Login successful',
    };

    res.status(200).json(response);
  }
);

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refresh = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body;
    const meta = getDeviceInfo(req);

    logger.debug('Token refresh attempt');

    const tokens = await refreshService(refreshToken, meta);

    const response: ApiResponse = {
      success: true,
      data: {
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 900, // 15 minutes in seconds
        },
      },
      message: 'Token refreshed successfully',
    };

    res.status(200).json(response);
  }
);

/**
 * Logout current session
 * POST /api/v1/auth/logout
 */
export const logout = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const { refreshToken } = req.body;

    logger.info('Logout attempt', { userId: req.user?.sub });

    await logoutService(refreshToken);

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.status(200).json(response);
  }
);

/**
 * Logout all sessions
 * POST /api/v1/auth/logout-all
 */
export const logoutAll = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    logger.info('Logout all sessions', { userId: req.user.sub });

    await logoutAllService(req.user.sub);

    const response: ApiResponse = {
      success: true,
      message: 'All sessions logged out successfully',
    };

    res.status(200).json(response);
  }
);

/**
 * Get current user profile
 * GET /api/v1/auth/me
 */
export const getProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    if (!req.user) {
      throw new Error('User not authenticated');
    }

    const user = await getProfileService(req.user.sub);

    const response: ApiResponse = {
      success: true,
      data: { user },
    };

    res.status(200).json(response);
  }
);

/**
 * Health check endpoint
 * GET /api/v1/health
 */
export const healthCheck = asyncHandler(
  async (_req: AuthenticatedRequest, res: Response, _next: NextFunction): Promise<void> => {
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
      },
    };

    res.status(200).json(response);
  }
);
