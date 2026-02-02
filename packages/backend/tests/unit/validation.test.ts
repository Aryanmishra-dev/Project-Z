/**
 * Validation schema tests
 * Tests for Zod validation schemas
 */
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  emailSchema,
  passwordSchema,
  fullNameSchema,
  paginationSchema,
  uuidSchema,
} from '@project-z/shared';
import { describe, it, expect } from 'vitest';

describe('Validation Schemas', () => {
  describe('emailSchema', () => {
    it('should accept valid email', () => {
      const result = emailSchema.safeParse('test@example.com');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should normalize email to lowercase', () => {
      const result = emailSchema.safeParse('TEST@EXAMPLE.COM');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should trim whitespace', () => {
      const result = emailSchema.safeParse('  test@example.com  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('test@example.com');
      }
    });

    it('should reject invalid email', () => {
      const result = emailSchema.safeParse('invalid-email');
      expect(result.success).toBe(false);
    });

    it('should reject email without domain', () => {
      const result = emailSchema.safeParse('test@');
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = emailSchema.safeParse('');
      expect(result.success).toBe(false);
    });
  });

  describe('passwordSchema', () => {
    it('should accept valid password', () => {
      const result = passwordSchema.safeParse('StrongP@ss123');
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const result = passwordSchema.safeParse('Sh@rt1');
      expect(result.success).toBe(false);
    });

    it('should reject password without uppercase', () => {
      const result = passwordSchema.safeParse('lowercase123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without lowercase', () => {
      const result = passwordSchema.safeParse('UPPERCASE123!');
      expect(result.success).toBe(false);
    });

    it('should reject password without digit', () => {
      const result = passwordSchema.safeParse('NoDigits!@#');
      expect(result.success).toBe(false);
    });

    it('should reject password without special char', () => {
      const result = passwordSchema.safeParse('NoSpecial123');
      expect(result.success).toBe(false);
    });
  });

  describe('fullNameSchema', () => {
    it('should accept valid name', () => {
      const result = fullNameSchema.safeParse('John Doe');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('John Doe');
      }
    });

    it('should accept names with hyphens', () => {
      const result = fullNameSchema.safeParse('Mary-Jane');
      expect(result.success).toBe(true);
    });

    it('should accept names with apostrophes', () => {
      const result = fullNameSchema.safeParse("O'Connor");
      expect(result.success).toBe(true);
    });

    it('should trim whitespace', () => {
      const result = fullNameSchema.safeParse('  John Doe  ');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('John Doe');
      }
    });

    it('should reject names with numbers', () => {
      const result = fullNameSchema.safeParse('John123');
      expect(result.success).toBe(false);
    });

    it('should reject too short name', () => {
      const result = fullNameSchema.safeParse('J');
      expect(result.success).toBe(false);
    });
  });

  describe('uuidSchema', () => {
    it('should accept valid UUID', () => {
      const result = uuidSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const result = uuidSchema.safeParse('not-a-uuid');
      expect(result.success).toBe(false);
    });

    it('should reject partial UUID', () => {
      const result = uuidSchema.safeParse('123e4567-e89b');
      expect(result.success).toBe(false);
    });
  });

  describe('registerSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'StrongP@ss123',
      fullName: 'John Doe',
    };

    it('should accept valid registration data', () => {
      const result = registerSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing email', () => {
      const { email, ...data } = validData;
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing password', () => {
      const { password, ...data } = validData;
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should reject missing fullName', () => {
      const { fullName, ...data } = validData;
      const result = registerSchema.safeParse(data);
      expect(result.success).toBe(false);
    });

    it('should normalize email', () => {
      const result = registerSchema.safeParse({
        ...validData,
        email: 'TEST@EXAMPLE.COM',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('test@example.com');
      }
    });
  });

  describe('loginSchema', () => {
    const validData = {
      email: 'test@example.com',
      password: 'anypassword',
    };

    it('should accept valid login data', () => {
      const result = loginSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should accept any password for login', () => {
      // Login shouldn't validate password strength
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: 'weak',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty password', () => {
      const result = loginSchema.safeParse({
        email: 'test@example.com',
        password: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('refreshTokenSchema', () => {
    it('should accept valid refresh token', () => {
      const result = refreshTokenSchema.safeParse({
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature',
      });
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = refreshTokenSchema.safeParse({
        refreshToken: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing token', () => {
      const result = refreshTokenSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe('paginationSchema', () => {
    it('should use default values', () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    it('should parse string numbers', () => {
      const result = paginationSchema.safeParse({
        page: '5',
        limit: '50',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
      }
    });

    it('should enforce max limit', () => {
      const result = paginationSchema.safeParse({
        limit: '200',
      });
      expect(result.success).toBe(false);
    });

    it('should enforce min page', () => {
      const result = paginationSchema.safeParse({
        page: '0',
      });
      expect(result.success).toBe(false);
    });
  });
});
