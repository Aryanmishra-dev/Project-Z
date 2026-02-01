/**
 * Error utilities tests
 * Tests for custom error classes
 */
import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalError,
  ServiceUnavailableError,
  isOperationalError,
} from '../../src/utils/errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
    });

    it('should support details', () => {
      const details = { field: 'email', reason: 'invalid' };
      const error = new AppError('Test error', 400, 'TEST_ERROR', true, details);
      
      expect(error.details).toEqual(details);
    });

    it('should have proper stack trace', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      expect(error.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    it('should create with field errors', () => {
      const fieldErrors = {
        email: ['Invalid email format'],
        password: ['Too short', 'Needs uppercase'],
      };
      const error = new ValidationError('Validation failed', fieldErrors);
      
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.fieldErrors).toEqual(fieldErrors);
    });

    it('should work without field errors', () => {
      const error = new ValidationError('Invalid input');
      
      expect(error.statusCode).toBe(400);
      expect(error.fieldErrors).toEqual({});
    });
  });

  describe('AuthenticationError', () => {
    it('should have correct status code', () => {
      const error = new AuthenticationError('Invalid token');
      
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });

    it('should use default message', () => {
      const error = new AuthenticationError();
      expect(error.message).toBe('Invalid credentials');
    });
  });

  describe('AuthorizationError', () => {
    it('should have correct status code', () => {
      const error = new AuthorizationError('Insufficient permissions');
      
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
    });

    it('should use default message', () => {
      const error = new AuthorizationError();
      expect(error.message).toBe('Insufficient permissions');
    });
  });

  describe('NotFoundError', () => {
    it('should have correct status code', () => {
      const error = new NotFoundError('User');
      
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('User not found');
    });
  });

  describe('ConflictError', () => {
    it('should have correct status code', () => {
      const error = new ConflictError('Email already exists');
      
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('RateLimitError', () => {
    it('should have correct status code and retryAfter', () => {
      const error = new RateLimitError(60);
      
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.retryAfter).toBe(60);
      expect(error.message).toBe('Too many requests, retry after 60 seconds');
    });
  });

  describe('InternalError', () => {
    it('should have correct status code', () => {
      const error = new InternalError('Database error');
      
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
    });

    it('should use default message', () => {
      const error = new InternalError();
      expect(error.message).toBe('Internal server error');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should have correct status code', () => {
      const error = new ServiceUnavailableError('Redis');
      
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
      expect(error.message).toBe('Redis is currently unavailable');
    });
  });

  describe('isOperationalError', () => {
    it('should return true for AppError', () => {
      const error = new AppError('Test', 400, 'TEST');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return true for ValidationError', () => {
      const error = new ValidationError('Test');
      expect(isOperationalError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Test');
      expect(isOperationalError(error)).toBe(false);
    });

    it('should return false for non-operational error', () => {
      const error = new InternalError('Test');
      expect(isOperationalError(error)).toBe(false);
    });
  });
});
