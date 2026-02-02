/**
 * Auth middleware tests
 * Tests for authentication and authorization middleware
 */
import { Response, NextFunction } from 'express';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment before importing
vi.stubEnv('JWT_SECRET', 'test-secret-key-for-jwt-testing-min-32-chars');
vi.stubEnv('JWT_ACCESS_EXPIRES', '15m');
vi.stubEnv('JWT_REFRESH_EXPIRES', '7d');

import { generateAccessToken } from '../../src/config/jwt';
import {
  authenticate,
  authorize,
  optionalAuth,
  AuthenticatedRequest,
} from '../../src/middleware/auth';
import { AuthenticationError, AuthorizationError } from '../../src/utils/errors';

describe('Auth Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  const mockUser = {
    sub: '123e4567-e89b-12d3-a456-426614174000',
    email: 'test@example.com',
    role: 'user' as const,
  };

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('authenticate', () => {
    it('should authenticate with valid token', () => {
      const token = generateAccessToken(mockUser.sub, mockUser.email, mockUser.role);
      mockReq.headers = { authorization: `Bearer ${token}` };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.sub).toBe(mockUser.sub);
      expect(mockReq.user?.email).toBe(mockUser.email);
    });

    it('should reject missing authorization header', () => {
      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject invalid token format', () => {
      mockReq.headers = { authorization: 'NotBearer token' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });

    it('should reject Bearer without token', () => {
      mockReq.headers = { authorization: 'Bearer' };

      authenticate(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('authorize', () => {
    it('should allow authorized role', () => {
      mockReq.user = { ...mockUser, type: 'access' as const, iat: 0, exp: 0 };
      const middleware = authorize('user');

      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should allow multiple roles', () => {
      mockReq.user = { ...mockUser, role: 'admin', type: 'access' as const, iat: 0, exp: 0 };
      const middleware = authorize('user', 'admin');

      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject unauthorized role', () => {
      mockReq.user = { ...mockUser, type: 'access' as const, iat: 0, exp: 0 };
      const middleware = authorize('admin');

      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthorizationError));
    });

    it('should reject when user not authenticated', () => {
      const middleware = authorize('user');

      middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(AuthenticationError));
    });
  });

  describe('optionalAuth', () => {
    it('should attach user with valid token', () => {
      const token = generateAccessToken(mockUser.sub, mockUser.email, mockUser.role);
      mockReq.headers = { authorization: `Bearer ${token}` };

      optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeDefined();
    });

    it('should continue without user when no token', () => {
      optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeUndefined();
    });

    it('should continue without user for invalid token', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      optionalAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.user).toBeUndefined();
    });
  });
});
